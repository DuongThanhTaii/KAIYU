import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XpStreakService } from '../xp-streak/xp-streak.service';

export interface AchievementWithEarned {
  id: string;
  code: string;
  title: string;
  description: string | null;
  icon: string | null;
  iconColor: string | null;
  xpReward: number;
  earnedAt: Date | null;
  currentValue?: number;
  targetValue?: number;
}

@Injectable()
export class AchievementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xpStreak: XpStreakService,
  ) {}

  /**
   * Get all achievements with earned status for a user
   */
  async getUserAchievements(userId: string): Promise<AchievementWithEarned[]> {
    // Fetch user stats for progress tracking
    const [vocabCount, flashcardReviewCount, videoCount, user] =
      await Promise.all([
        this.prisma.userVocabulary.count({ where: { userId } }),
        this.prisma.flashcardReview.aggregate({
          where: { userId },
          _sum: { reviewCount: true },
        }),
        this.prisma.videoProgress.count({
          where: { userId, progressPercent: { gte: 80 } },
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { streak: true },
        }),
      ]);

    const totalReviews = flashcardReviewCount._sum.reviewCount || 0;
    const streak = user?.streak || 0;

    // Define target values for each achievement code
    const progressMap: Record<string, { current: number; target: number }> = {
      first_word: { current: Math.min(vocabCount, 1), target: 1 },
      vocab_10: { current: Math.min(vocabCount, 10), target: 10 },
      vocab_50: { current: Math.min(vocabCount, 50), target: 50 },
      vocab_100: { current: Math.min(vocabCount, 100), target: 100 },
      flashcard_10: { current: Math.min(totalReviews, 10), target: 10 },
      flashcard_100: { current: Math.min(totalReviews, 100), target: 100 },
      video_first: { current: Math.min(videoCount, 1), target: 1 },
      video_10: { current: Math.min(videoCount, 10), target: 10 },
      streak_7: { current: Math.min(streak, 7), target: 7 },
      streak_30: { current: Math.min(streak, 30), target: 30 },
    };

    const allAchievements = await this.prisma.achievement.findMany({
      include: {
        earnedBy: {
          where: { userId },
          select: { earnedAt: true },
        },
      },
      orderBy: { title: 'asc' },
    });

    return allAchievements.map((a) => {
      const progress = progressMap[a.code];
      return {
        id: a.id,
        code: a.code,
        title: a.title,
        description: a.description,
        icon: a.icon,
        iconColor: a.iconColor,
        xpReward: a.xpReward,
        earnedAt: a.earnedBy.length > 0 ? a.earnedBy[0].earnedAt : null,
        currentValue: progress?.current,
        targetValue: progress?.target,
      };
    });
  }

  /**
   * Get only earned achievements for a user (for dashboard display)
   */
  async getEarnedAchievements(userId: string) {
    const earned = await this.prisma.achievementEarned.findMany({
      where: { userId },
      include: {
        achievement: true,
      },
      orderBy: { earnedAt: 'desc' },
      take: 10,
    });

    return earned.map((e) => ({
      id: e.achievement.id,
      code: e.achievement.code,
      title: e.achievement.title,
      description: e.achievement.description,
      icon: e.achievement.icon,
      iconColor: e.achievement.iconColor,
      xpReward: e.achievement.xpReward,
      earnedAt: e.earnedAt,
    }));
  }

  /**
   * Check and award achievements based on user activity
   */
  async checkAndAwardAchievements(
    userId: string,
  ): Promise<AchievementWithEarned[]> {
    const newlyAwarded: AchievementWithEarned[] = [];

    // Get user stats for checking
    const [vocabCount, flashcardReviewCount, videoCount, user] =
      await Promise.all([
        this.prisma.userVocabulary.count({ where: { userId } }),
        this.prisma.flashcardReview.aggregate({
          where: { userId },
          _sum: { reviewCount: true },
        }),
        this.prisma.videoProgress.count({
          where: { userId, progressPercent: { gte: 80 } },
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { streak: true },
        }),
      ]);

    const totalReviews = flashcardReviewCount._sum.reviewCount || 0;
    const streak = user?.streak || 0;

    // Define achievement checks
    const checks = [
      { code: 'first_word', condition: vocabCount >= 1 },
      { code: 'vocab_10', condition: vocabCount >= 10 },
      { code: 'vocab_50', condition: vocabCount >= 50 },
      { code: 'vocab_100', condition: vocabCount >= 100 },
      { code: 'flashcard_10', condition: totalReviews >= 10 },
      { code: 'flashcard_100', condition: totalReviews >= 100 },
      { code: 'video_first', condition: videoCount >= 1 },
      { code: 'video_10', condition: videoCount >= 10 },
      { code: 'streak_7', condition: streak >= 7 },
      { code: 'streak_30', condition: streak >= 30 },
    ];

    for (const check of checks) {
      if (check.condition) {
        const awarded = await this.awardAchievement(userId, check.code);
        if (awarded) {
          newlyAwarded.push(awarded);
        }
      }
    }

    return newlyAwarded;
  }

  /**
   * Award a specific achievement to user if not already earned
   * Also awards XP to the user
   */
  private async awardAchievement(
    userId: string,
    code: string,
  ): Promise<AchievementWithEarned | null> {
    const achievement = await this.prisma.achievement.findUnique({
      where: { code },
    });

    if (!achievement) return null;

    // Check if already earned
    const existing = await this.prisma.achievementEarned.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId: achievement.id,
        },
      },
    });

    if (existing) return null;

    // Award the achievement
    const earned = await this.prisma.achievementEarned.create({
      data: {
        userId,
        achievementId: achievement.id,
      },
    });

    // Award XP for earning this achievement
    if (achievement.xpReward > 0) {
      await this.xpStreak.awardXp(
        userId,
        achievement.xpReward,
        `achievement_${code}`,
      );
    }

    return {
      id: achievement.id,
      code: achievement.code,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      iconColor: achievement.iconColor,
      xpReward: achievement.xpReward,
      earnedAt: earned.earnedAt,
    };
  }

  /**
   * Get all available achievements (for achievement gallery)
   */
  async getAllAchievements() {
    return this.prisma.achievement.findMany({
      orderBy: { title: 'asc' },
    });
  }
}
