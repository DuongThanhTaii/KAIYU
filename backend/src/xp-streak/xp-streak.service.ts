import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class XpStreakService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Award XP to user
     */
    async awardXp(userId: string, amount: number, reason?: string): Promise<number> {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { xp: { increment: amount } },
            select: { xp: true },
        });
        console.log(`Awarded ${amount} XP to user ${userId}. Reason: ${reason}. New total: ${user.xp}`);
        return user.xp;
    }

    /**
     * Update streak based on Duolingo logic:
     * - If last active was yesterday: streak++
     * - If last active was today: no change
     * - If last active was before yesterday: streak = 1 (reset)
     * - Also update lastActiveDate to today
     */
    async updateStreak(userId: string): Promise<{ streak: number; isNewDay: boolean }> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { streak: true, lastActiveDate: true },
        });

        if (!user) return { streak: 0, isNewDay: false };

        // Use Vietnam timezone (UTC+7)
        const vietnamOffset = 7 * 60 * 60 * 1000;
        const now = new Date();
        const vietnamNow = new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + vietnamOffset);
        const todayStr = vietnamNow.toISOString().split('T')[0];
        const today = new Date(todayStr);

        const lastActive = user.lastActiveDate;
        let newStreak = user.streak;
        let isNewDay = false;

        if (!lastActive) {
            // First ever activity
            newStreak = 1;
            isNewDay = true;
        } else {
            const lastActiveStr = lastActive.toISOString().split('T')[0];
            const lastActiveDate = new Date(lastActiveStr);
            const diffDays = Math.floor((today.getTime() - lastActiveDate.getTime()) / (24 * 60 * 60 * 1000));

            if (diffDays === 0) {
                // Same day, no change
                isNewDay = false;
            } else if (diffDays === 1) {
                // Yesterday - continue streak
                newStreak = user.streak + 1;
                isNewDay = true;
            } else {
                // Streak broken - reset to 1
                newStreak = 1;
                isNewDay = true;
            }
        }

        if (isNewDay) {
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    streak: newStreak,
                    lastActiveDate: today,
                },
            });
        }

        return { streak: newStreak, isNewDay };
    }

    /**
     * Record session time (study minutes)
     */
    async addStudyTime(userId: string, minutes: number): Promise<number> {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { totalStudyMinutes: { increment: minutes } },
            select: { totalStudyMinutes: true },
        });
        return user.totalStudyMinutes;
    }

    /**
     * Get user XP and streak info
     */
    async getUserStats(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                xp: true,
                streak: true,
                totalStudyMinutes: true,
                lastActiveDate: true,
                dailyGoalMinutes: true,
            },
        });
        return user;
    }

    /**
     * Called when user activity happens - updates streak and awards XP
     */
    async recordActivity(userId: string, xpAmount: number, reason?: string) {
        // Update streak
        const streakResult = await this.updateStreak(userId);

        // Award XP
        const newXp = await this.awardXp(userId, xpAmount, reason);

        return {
            xp: newXp,
            streak: streakResult.streak,
            isNewDay: streakResult.isNewDay,
        };
    }
}
