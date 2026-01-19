import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XpStreakService } from '../xp-streak/xp-streak.service';

export type SRSRating = 'again' | 'hard' | 'good' | 'easy';

@Injectable()
export class FlashcardsService {
    constructor(
        private prisma: PrismaService,
        private xpStreak: XpStreakService,
    ) { }

    /**
     * Calculate proficiency level (1-5) based on interval days
     * Level 1: New (interval 0)
     * Level 2: Learning (interval 1-3 days)
     * Level 3: Familiar (interval 4-7 days)
     * Level 4: Known (interval 8-30 days)
     * Level 5: Mastered (interval > 30 days)
     */
    getLevel(intervalDays: number): number {
        if (intervalDays === 0) return 1;      // Mới học
        if (intervalDays <= 3) return 2;       // Đang học  
        if (intervalDays <= 7) return 3;       // Quen
        if (intervalDays <= 30) return 4;      // Thuộc
        return 5;                              // Thành thạo
    }

    async getQueue(userId: string) {
        const now = new Date();

        // Get cards due for review
        const dueCards = await this.prisma.flashcardReview.findMany({
            where: {
                userId,
                nextReviewAt: { lte: now },
            },
            include: {
                vocabulary: true,
            },
            orderBy: [
                { status: 'asc' }, // 'new' first, then 'learning', then 'review'
                { nextReviewAt: 'asc' },
            ],
            take: 50, // Limit queue size
        });

        // Get counts by status
        const statusCounts = await this.prisma.flashcardReview.groupBy({
            by: ['status'],
            where: {
                userId,
                nextReviewAt: { lte: now },
            },
            _count: { id: true },
        });

        const stats = statusCounts.reduce((acc, curr) => {
            acc[curr.status] = curr._count.id;
            return acc;
        }, {} as Record<string, number>);

        // Fetch UserVocabulary context for each card
        const vocabularyIds = dueCards.map(card => card.vocabularyId);
        const userVocabContexts = await this.prisma.userVocabulary.findMany({
            where: {
                userId,
                vocabularyId: { in: vocabularyIds },
            },
            select: {
                vocabularyId: true,
                sourceTimestamp: true,
                sourceSentence: true,
                sourcePinyin: true,
                sourceImageUrl: true,
                sourceAudioUrl: true,
                // Include source video for clip playback
                sourceVideo: {
                    select: {
                        videoUrl: true,
                    },
                },
            },
        });

        // Create a map for quick lookup
        const contextMap = new Map(
            userVocabContexts.map(uv => [uv.vocabularyId, uv])
        );

        return {
            cards: dueCards.map((card) => {
                const context = contextMap.get(card.vocabularyId);
                return {
                    id: card.id,
                    vocabularyId: card.vocabularyId,
                    word: card.vocabulary,
                    status: card.status,
                    reviewCount: card.reviewCount,
                    intervalDays: card.intervalDays,
                    level: this.getLevel(card.intervalDays), // Add level 1-5
                    // Context from UserVocabulary for rich flashcards
                    sourceTimestamp: context?.sourceTimestamp ? Number(context.sourceTimestamp) : undefined,
                    sourceSentence: context?.sourceSentence || undefined,
                    sourcePinyin: context?.sourcePinyin || undefined,
                    sourceImageUrl: context?.sourceImageUrl || undefined,
                    sourceAudioUrl: context?.sourceAudioUrl || undefined,
                    // Video URL for clip playback
                    sourceVideoUrl: context?.sourceVideo?.videoUrl || undefined,
                };
            }),
            stats: {
                new: stats.new || 0,
                learning: stats.learning || 0,
                review: stats.review || 0,
                total: dueCards.length,
            },
        };
    }

    async submitReview(userId: string, cardId: string, rating: SRSRating) {
        const card = await this.prisma.flashcardReview.findFirst({
            where: { id: cardId, userId },
        });

        if (!card) {
            throw new NotFoundException('Flashcard not found');
        }

        // Calculate new interval and ease factor using SM-2 algorithm
        const { newInterval, newEaseFactor, newStatus } = this.calculateSRS(
            card.intervalDays,
            Number(card.easeFactor),
            card.status,
            rating,
        );

        // Calculate next review date
        const nextReviewAt = new Date();
        if (newInterval > 0) {
            nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);
        } else {
            // For 'again' rating, add 1 minute
            nextReviewAt.setMinutes(nextReviewAt.getMinutes() + 1);
        }

        // Update the card
        const updatedCard = await this.prisma.flashcardReview.update({
            where: { id: cardId },
            data: {
                intervalDays: newInterval,
                easeFactor: newEaseFactor,
                status: newStatus,
                reviewCount: { increment: 1 },
                nextReviewAt,
                lastReviewAt: new Date(),
            },
            include: { vocabulary: true },
        });

        // Also update proficiency in user_vocabulary
        await this.updateUserVocabularyProficiency(
            userId,
            card.vocabularyId,
            newStatus,
            newInterval,
        );

        // Award XP for flashcard review (1 XP per card)
        await this.xpStreak.recordActivity(userId, 1, 'flashcard_review');

        return {
            id: updatedCard.id,
            nextReviewAt: updatedCard.nextReviewAt,
            intervalDays: updatedCard.intervalDays,
            status: updatedCard.status,
            level: this.getLevel(updatedCard.intervalDays), // Add level
        };
    }

    async getStats(userId: string) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [totalReviews, todayReviews, weeklyReviews, byStatus] = await Promise.all([
            this.prisma.flashcardReview.count({ where: { userId } }),
            this.prisma.flashcardReview.count({
                where: {
                    userId,
                    lastReviewAt: { gte: today },
                },
            }),
            this.prisma.flashcardReview.count({
                where: {
                    userId,
                    lastReviewAt: { gte: weekAgo },
                },
            }),
            this.prisma.flashcardReview.groupBy({
                by: ['status'],
                where: { userId },
                _count: { id: true },
            }),
        ]);

        const statusStats = byStatus.reduce((acc, curr) => {
            acc[curr.status] = curr._count.id;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalCards: totalReviews,
            todayReviewed: todayReviews,
            weeklyReviewed: weeklyReviews,
            new: statusStats.new || 0,
            learning: statusStats.learning || 0,
            review: statusStats.review || 0,
        };
    }

    private calculateSRS(
        currentInterval: number,
        currentEaseFactor: number,
        currentStatus: string,
        rating: SRSRating,
    ): { newInterval: number; newEaseFactor: number; newStatus: string } {
        let newInterval = currentInterval;
        let newEaseFactor = currentEaseFactor;
        let newStatus = currentStatus;

        // SM-2 algorithm implementation
        switch (rating) {
            case 'again':
                newInterval = 0;
                newEaseFactor = Math.max(1.3, currentEaseFactor - 0.2);
                newStatus = 'learning';
                break;
            case 'hard':
                newInterval = Math.max(1, Math.floor(currentInterval * 1.2));
                newEaseFactor = Math.max(1.3, currentEaseFactor - 0.15);
                newStatus = currentStatus === 'new' ? 'learning' : 'review';
                break;
            case 'good':
                if (currentStatus === 'new') {
                    newInterval = 1;
                    newStatus = 'learning';
                } else if (currentStatus === 'learning') {
                    newInterval = 4;
                    newStatus = 'review';
                } else {
                    newInterval = Math.floor(currentInterval * currentEaseFactor);
                    newStatus = 'review';
                }
                break;
            case 'easy':
                if (currentStatus === 'new') {
                    newInterval = 4;
                    newStatus = 'review';
                } else {
                    newInterval = Math.floor(currentInterval * currentEaseFactor * 1.3);
                    newStatus = 'review';
                }
                newEaseFactor = currentEaseFactor + 0.15;
                break;
        }

        return { newInterval, newEaseFactor, newStatus };
    }

    private async updateUserVocabularyProficiency(
        userId: string,
        vocabularyId: string,
        status: string,
        interval: number,
    ) {
        let proficiency: string;
        let proficiencyPercent: number;

        if (status === 'new') {
            proficiency = 'new';
            proficiencyPercent = 0;
        } else if (status === 'learning') {
            proficiency = 'learning';
            proficiencyPercent = Math.min(40, interval * 10);
        } else if (interval < 21) {
            proficiency = 'review';
            proficiencyPercent = Math.min(80, 40 + interval * 2);
        } else {
            proficiency = 'mastered';
            proficiencyPercent = Math.min(100, 80 + interval);
        }

        await this.prisma.userVocabulary.updateMany({
            where: { userId, vocabularyId },
            data: {
                proficiency,
                proficiencyPercent,
                lastReviewedAt: new Date(),
            },
        });
    }

    /**
     * Get all vocabulary grouped by level (1-5)
     */
    async getByLevel(userId: string, level?: number) {
        const allCards = await this.prisma.flashcardReview.findMany({
            where: { userId },
            include: { vocabulary: true },
            orderBy: { intervalDays: 'desc' },
        });

        const cardsWithLevel = allCards.map(card => ({
            id: card.id,
            vocabularyId: card.vocabularyId,
            word: card.vocabulary,
            status: card.status,
            intervalDays: card.intervalDays,
            level: this.getLevel(card.intervalDays),
            reviewCount: card.reviewCount,
            nextReviewAt: card.nextReviewAt,
        }));

        if (level) {
            return cardsWithLevel.filter(card => card.level === level);
        }

        return cardsWithLevel;
    }

    /**
     * Get statistics by level (1-5)
     */
    async getStatsByLevel(userId: string) {
        const allCards = await this.prisma.flashcardReview.findMany({
            where: { userId },
            select: { intervalDays: true },
        });

        const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        allCards.forEach(card => {
            const level = this.getLevel(card.intervalDays);
            levelCounts[level as keyof typeof levelCounts]++;
        });

        return {
            total: allCards.length,
            levels: levelCounts,
            levelLabels: {
                1: 'Mới học',
                2: 'Đang học',
                3: 'Quen',
                4: 'Thuộc',
                5: 'Thành thạo',
            },
        };
    }

    /**
     * Get recently added vocabulary for quick review
     * Can filter by videoId to show vocab from specific video
     */
    async getRecentlyAdded(userId: string, options?: { videoId?: string; limit?: number }) {
        const limit = options?.limit || 10;

        // Get recently saved user vocabulary
        const recentVocab = await this.prisma.userVocabulary.findMany({
            where: {
                userId,
                ...(options?.videoId && { sourceVideoId: options.videoId }),
            },
            include: {
                vocabulary: true,
                sourceVideo: {
                    select: { id: true, title: true, thumbnailUrl: true },
                },
            },
            orderBy: { savedAt: 'desc' },
            take: limit,
        });

        // Get corresponding flashcard reviews
        const vocabIds = recentVocab.map(v => v.vocabularyId);
        const flashcardReviews = await this.prisma.flashcardReview.findMany({
            where: {
                userId,
                vocabularyId: { in: vocabIds },
            },
        });

        const reviewMap = new Map(flashcardReviews.map(r => [r.vocabularyId, r]));

        return recentVocab.map(vocab => {
            const review = reviewMap.get(vocab.vocabularyId);
            return {
                id: vocab.id,
                vocabularyId: vocab.vocabularyId,
                word: vocab.vocabulary,
                sourceVideo: vocab.sourceVideo,
                sourceTimestamp: vocab.sourceTimestamp ? Number(vocab.sourceTimestamp) : null,
                sourceSentence: vocab.sourceSentence,
                sourcePinyin: vocab.sourcePinyin,
                savedAt: vocab.savedAt,
                status: review?.status || 'new',
                intervalDays: review?.intervalDays || 0,
                level: this.getLevel(review?.intervalDays || 0),
                reviewCount: review?.reviewCount || 0,
            };
        });
    }
}
