import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TrendingScene {
    id: string;
    title: string;
    scenarioType: string;
    playCount: number;
    avgScore: number;
    vocabUsed: string[];
    creatorName?: string;
}

export interface PopularVocabCombo {
    vocab: string[];
    count: number;
    scenarioType: string;
}

@Injectable()
export class SceneAnalyticsService {
    constructor(private prisma: PrismaService) { }

    /**
     * Track scene play - update analytics
     */
    async trackScenePlay(
        sceneId: string | null,
        templateId: string | null,
        scenarioType: string,
        vocabUsed: string[],
        score: number,
    ) {
        // Find or create analytics entry
        const existing = sceneId
            ? await this.prisma.sceneAnalytics.findUnique({
                where: { sceneId },
            })
            : null;

        if (existing) {
            // Update existing
            const newTotal = existing.totalScore + score;
            const newCount = existing.playCount + 1;
            const newAvg = newTotal / newCount;

            await this.prisma.sceneAnalytics.update({
                where: { id: existing.id },
                data: {
                    playCount: newCount,
                    totalScore: newTotal,
                    avgScore: newAvg,
                    lastPlayedAt: new Date(),
                },
            });
        } else {
            // Create new analytics entry
            await this.prisma.sceneAnalytics.create({
                data: {
                    sceneId,
                    templateId,
                    scenarioType,
                    vocabUsed,
                    playCount: 1,
                    totalScore: score,
                    avgScore: score,
                },
            });
        }
    }

    /**
     * Get trending/popular scenes
     */
    async getTrendingScenes(limit = 10): Promise<TrendingScene[]> {
        const analytics = await this.prisma.sceneAnalytics.findMany({
            where: {
                playCount: { gte: 2 }, // At least 2 plays
            },
            orderBy: [
                { playCount: 'desc' },
                { avgScore: 'desc' },
            ],
            take: limit,
            include: {
                scene: {
                    include: {
                        creator: {
                            select: { name: true },
                        },
                    },
                },
                template: true,
            },
        });

        return analytics.map((a) => ({
            id: a.sceneId || a.templateId || a.id,
            title: a.scene?.title || a.template?.nameVi || a.scenarioType,
            scenarioType: a.scenarioType,
            playCount: a.playCount,
            avgScore: Math.round(a.avgScore),
            vocabUsed: a.vocabUsed,
            creatorName: a.scene?.creator?.name,
        }));
    }

    /**
     * Get popular vocabulary combinations
     */
    async getPopularVocabCombos(limit = 10): Promise<PopularVocabCombo[]> {
        // Group by vocab combinations
        const analytics = await this.prisma.sceneAnalytics.findMany({
            orderBy: { playCount: 'desc' },
            take: 50,
        });

        // Count vocab combos
        const comboMap = new Map<string, PopularVocabCombo>();

        for (const a of analytics) {
            const key = a.vocabUsed.sort().join('|');
            const existing = comboMap.get(key);
            if (existing) {
                existing.count += a.playCount;
            } else {
                comboMap.set(key, {
                    vocab: a.vocabUsed,
                    count: a.playCount,
                    scenarioType: a.scenarioType,
                });
            }
        }

        // Sort and return top combos
        return Array.from(comboMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * Get public/shared scenes
     */
    async getPublicScenes(limit = 20) {
        return this.prisma.generatedScene.findMany({
            where: {
                isPublic: true,
            },
            orderBy: [
                { usageCount: 'desc' },
                { likesCount: 'desc' },
            ],
            take: limit,
            include: {
                creator: {
                    select: { id: true, name: true, avatarUrl: true },
                },
                template: {
                    select: { name: true, nameVi: true, category: true },
                },
            },
        });
    }

    /**
     * Share a scene (make it public)
     */
    async shareScene(sceneId: string, userId: string, title: string) {
        return this.prisma.generatedScene.update({
            where: { id: sceneId },
            data: {
                isPublic: true,
                title,
                creatorId: userId,
            },
        });
    }

    /**
     * Like a shared scene
     */
    async likeScene(sceneId: string) {
        return this.prisma.generatedScene.update({
            where: { id: sceneId },
            data: {
                likesCount: { increment: 1 },
            },
        });
    }

    /**
     * Get pre-generated suggestions based on popular combinations
     */
    async getPreGeneratedSuggestions(scenarioType: string, limit = 5) {
        // Find most popular scenes for this scenario type
        const analytics = await this.prisma.sceneAnalytics.findMany({
            where: {
                scenarioType,
                scene: { isNot: null },
            },
            orderBy: { playCount: 'desc' },
            take: limit,
            include: {
                scene: true,
            },
        });

        return analytics
            .filter((a) => a.scene)
            .map((a) => ({
                sceneId: a.sceneId,
                vocabUsed: a.vocabUsed,
                playCount: a.playCount,
                avgScore: Math.round(a.avgScore),
                dialogFlow: a.scene?.dialogFlow,
            }));
    }
}
