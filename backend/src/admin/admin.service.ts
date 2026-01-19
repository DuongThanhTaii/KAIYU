import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
    constructor(private prisma: PrismaService) { }

    // ============ Dashboard Stats ============
    async getOverviewStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [userCount, videoCount, vocabCount, recentUsers, todayLearningCount] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.video.count(),
            this.prisma.vocabulary.count(),
            this.prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, name: true, email: true, createdAt: true },
            }),
            // Count of flashcard reviews today
            this.prisma.flashcardReview.count({
                where: {
                    lastReviewAt: { gte: today },
                },
            }),
        ]);

        const publishedVideos = await this.prisma.video.count({
            where: { isPublished: true },
        });

        // Get daily activity for last 7 days
        const dailyActivity = await this.getDailyActivityStats(7);

        return {
            users: userCount,
            videos: videoCount,
            publishedVideos,
            vocabulary: vocabCount,
            recentUsers,
            todayLearningCount,
            dailyActivity,
        };
    }

    // Method to get daily stats for the activity chart (public for direct API access)
    async getDailyActivityStats(days: number) {
        const result: { date: string; label: string; newUsers: number; videoViews: number }[] = [];
        const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const [newUsers, videoViews] = await Promise.all([
                this.prisma.user.count({
                    where: {
                        createdAt: { gte: date, lt: nextDate },
                    },
                }),
                // Use video progress updates as proxy for video views
                this.prisma.videoProgress.count({
                    where: {
                        lastWatchedAt: { gte: date, lt: nextDate },
                    },
                }),
            ]);

            result.push({
                date: date.toISOString().split('T')[0],
                label: dayLabels[date.getDay()],
                newUsers,
                videoViews,
            });
        }

        return result;
    }

    // ============ Notifications ============
    async getNotifications(limit: number = 10) {
        const notifications: {
            id: string;
            type: 'user' | 'video' | 'achievement' | 'vocabulary';
            message: string;
            time: string;
            createdAt: Date;
        }[] = [];

        // Get recent user registrations
        const recentUsers = await this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, name: true, email: true, createdAt: true },
        });

        for (const user of recentUsers) {
            notifications.push({
                id: `user-${user.id}`,
                type: 'user',
                message: `Người dùng mới đăng ký: ${user.name}`,
                time: this.formatTimeAgo(user.createdAt),
                createdAt: user.createdAt,
            });
        }

        // Get recent videos created
        const recentVideos = await this.prisma.video.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, title: true, createdAt: true },
        });

        for (const video of recentVideos) {
            notifications.push({
                id: `video-${video.id}`,
                type: 'video',
                message: `Video mới: ${video.title}`,
                time: this.formatTimeAgo(video.createdAt),
                createdAt: video.createdAt,
            });
        }

        // Get recent achievements earned
        const recentAchievements = await this.prisma.achievementEarned.findMany({
            orderBy: { earnedAt: 'desc' },
            take: 5,
            include: {
                user: { select: { name: true } },
                achievement: { select: { title: true } },
            },
        });

        for (const earned of recentAchievements) {
            notifications.push({
                id: `achievement-${earned.id}`,
                type: 'achievement',
                message: `${earned.user.name} đạt thành tựu: ${earned.achievement.title}`,
                time: this.formatTimeAgo(earned.earnedAt),
                createdAt: earned.earnedAt,
            });
        }

        // Sort all notifications by createdAt and take top N
        notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return notifications.slice(0, limit).map(({ createdAt, ...rest }) => rest);
    }

    // Helper to format relative time
    private formatTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;
        return date.toLocaleDateString('vi-VN');
    }

    // ============ Video Management ============
    async getAllVideos(query: { page?: number; limit?: number; isPublished?: boolean }) {
        const { page = 1, limit = 20, isPublished } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (isPublished !== undefined) {
            where.isPublished = isPublished;
        }

        const [videos, total] = await Promise.all([
            this.prisma.video.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: { select: { subtitles: true } },
                },
            }),
            this.prisma.video.count({ where }),
        ]);

        return {
            data: videos,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async createVideo(data: any) {
        return this.prisma.video.create({ data });
    }

    async updateVideo(id: string, data: any) {
        const video = await this.prisma.video.findUnique({ where: { id } });
        if (!video) throw new NotFoundException('Video not found');
        return this.prisma.video.update({ where: { id }, data });
    }

    async deleteVideo(id: string) {
        const video = await this.prisma.video.findUnique({ where: { id } });
        if (!video) throw new NotFoundException('Video not found');
        await this.prisma.video.delete({ where: { id } });
        return { message: 'Video deleted' };
    }

    async publishVideo(id: string) {
        const video = await this.prisma.video.findUnique({ where: { id } });
        if (!video) throw new NotFoundException('Video not found');
        return this.prisma.video.update({
            where: { id },
            data: { isPublished: true },
        });
    }

    // ============ Subtitle Management ============
    async addSubtitles(videoId: string, subtitlesData: any[]) {
        const video = await this.prisma.video.findUnique({ where: { id: videoId } });
        if (!video) throw new NotFoundException('Video not found');

        // Delete existing subtitles
        await this.prisma.subtitle.deleteMany({ where: { videoId } });

        // Create new subtitles
        const subtitles = await this.prisma.subtitle.createMany({
            data: subtitlesData.map((sub, index) => ({
                videoId,
                startTime: sub.startTime,
                endTime: sub.endTime,
                hanzi: sub.hanzi,
                pinyin: sub.pinyin,
                meaningEn: sub.meaningEn || '',
                meaningVi: sub.meaningVi,
                sequenceOrder: index,
            })),
        });

        // Update video vocab count
        await this.prisma.video.update({
            where: { id: videoId },
            data: { vocabCount: subtitlesData.length },
        });

        return { message: `Created ${subtitles.count} subtitles` };
    }

    // ============ Vocabulary Management ============
    async getAllVocabulary(query: { page?: number; limit?: number; hskLevel?: number }) {
        const { page = 1, limit = 50, hskLevel } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (hskLevel) where.hskLevel = hskLevel;

        const [vocab, total] = await Promise.all([
            this.prisma.vocabulary.findMany({
                where,
                skip,
                take: limit,
                orderBy: { hskLevel: 'asc' },
            }),
            this.prisma.vocabulary.count({ where }),
        ]);

        return {
            data: vocab,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async createVocabulary(data: any) {
        return this.prisma.vocabulary.create({ data });
    }

    async updateVocabulary(id: string, data: any) {
        const vocab = await this.prisma.vocabulary.findUnique({ where: { id } });
        if (!vocab) throw new NotFoundException('Vocabulary not found');
        return this.prisma.vocabulary.update({ where: { id }, data });
    }

    async deleteVocabulary(id: string) {
        const vocab = await this.prisma.vocabulary.findUnique({ where: { id } });
        if (!vocab) throw new NotFoundException('Vocabulary not found');
        await this.prisma.vocabulary.delete({ where: { id } });
        return { message: 'Vocabulary deleted' };
    }

    async importVocabulary(vocabList: any[]) {
        const results = { created: 0, skipped: 0, errors: 0 };

        for (const item of vocabList) {
            try {
                await this.prisma.vocabulary.upsert({
                    where: { hanzi: item.hanzi },
                    create: {
                        hanzi: item.hanzi,
                        pinyin: item.pinyin,
                        meaningEn: item.meaningEn,
                        meaningVi: item.meaningVi,
                        partOfSpeech: item.partOfSpeech,
                        hskLevel: item.hskLevel || 1,
                        tags: item.tags || [],
                    },
                    update: {
                        pinyin: item.pinyin,
                        meaningEn: item.meaningEn,
                        meaningVi: item.meaningVi,
                        partOfSpeech: item.partOfSpeech,
                        hskLevel: item.hskLevel,
                    },
                });
                results.created++;
            } catch (error) {
                results.errors++;
            }
        }

        return results;
    }

    // ============ User Management ============
    async getAllUsers(query: { page?: number; limit?: number; role?: string }) {
        const { page = 1, limit = 20, role } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (role) where.role = role;

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true,
                    hskLevel: true,
                    streak: true,
                    isPremium: true,
                    role: true,
                    createdAt: true,
                    _count: { select: { userVocabulary: true } },
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            data: users,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async updateUserRole(id: string, role: string) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('User not found');
        return this.prisma.user.update({
            where: { id },
            data: { role },
            select: { id: true, email: true, name: true, role: true },
        });
    }

    async deleteUser(id: string) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('User not found');

        // Prisma cascade sẽ tự động xóa các data liên quan
        // vì đã cấu hình onDelete: Cascade trong schema
        await this.prisma.user.delete({ where: { id } });
        return { message: 'User deleted successfully' };
    }

    // ============ Achievement Management ============
    async getAllAchievements(query: { page?: number; limit?: number }) {
        const { page = 1, limit = 50 } = query;
        const skip = (page - 1) * limit;

        const [achievements, total] = await Promise.all([
            this.prisma.achievement.findMany({
                skip,
                take: limit,
                orderBy: { code: 'asc' },
                include: {
                    _count: { select: { earnedBy: true } },
                },
            }),
            this.prisma.achievement.count(),
        ]);

        // Transform data to include earnedCount
        const data = achievements.map(a => ({
            ...a,
            earnedCount: a._count.earnedBy,
            _count: undefined,
        }));

        return {
            data,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async createAchievement(data: {
        code: string;
        title: string;
        description?: string;
        icon?: string;
        iconColor?: string;
        xpReward?: number;
    }) {
        return this.prisma.achievement.create({
            data: {
                code: data.code,
                title: data.title,
                description: data.description,
                icon: data.icon,
                iconColor: data.iconColor,
                xpReward: data.xpReward || 0,
            },
        });
    }

    async updateAchievement(id: string, data: {
        code?: string;
        title?: string;
        description?: string;
        icon?: string;
        iconColor?: string;
        xpReward?: number;
    }) {
        const achievement = await this.prisma.achievement.findUnique({ where: { id } });
        if (!achievement) throw new NotFoundException('Achievement not found');

        return this.prisma.achievement.update({
            where: { id },
            data,
        });
    }

    async deleteAchievement(id: string) {
        const achievement = await this.prisma.achievement.findUnique({ where: { id } });
        if (!achievement) throw new NotFoundException('Achievement not found');

        // Delete related earned achievements first
        await this.prisma.achievementEarned.deleteMany({ where: { achievementId: id } });
        await this.prisma.achievement.delete({ where: { id } });

        return { message: 'Achievement deleted successfully' };
    }
}
