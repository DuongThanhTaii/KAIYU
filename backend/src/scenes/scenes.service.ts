import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SceneTemplate, GeneratedScene, UserSceneHistory } from '@prisma/client';
import * as crypto from 'crypto';

export interface VocabItem {
    hanzi: string;
    pinyin: string;
    meaningVi: string;
}

export interface VocabSlots {
    [key: string]: VocabItem;
}

@Injectable()
export class ScenesService {
    constructor(private prisma: PrismaService) { }

    /**
     * Get all active scene templates
     */
    async getTemplates(hskLevel?: number): Promise<SceneTemplate[]> {
        return this.prisma.sceneTemplate.findMany({
            where: {
                isActive: true,
                ...(hskLevel && { hskLevel: { lte: hskLevel } }),
            },
            orderBy: [
                { hskLevel: 'asc' },
                { usageCount: 'desc' },
            ],
        });
    }

    /**
     * Get a single template by ID
     */
    async getTemplateById(id: string): Promise<SceneTemplate> {
        const template = await this.prisma.sceneTemplate.findUnique({
            where: { id },
        });

        if (!template) {
            throw new NotFoundException('Scene template not found');
        }

        // Increment usage count
        await this.prisma.sceneTemplate.update({
            where: { id },
            data: { usageCount: { increment: 1 } },
        });

        return template;
    }

    /**
     * Generate a scene by injecting user's vocabulary into a template
     */
    async generateScene(
        templateId: string,
        vocabSlots: VocabSlots,
        userId?: string,
    ): Promise<GeneratedScene> {
        const template = await this.getTemplateById(templateId);

        // Create a hash of vocab for caching
        const vocabHash = this.hashVocab(vocabSlots);

        // Check if we have a cached scene with same vocab
        const cached = await this.prisma.generatedScene.findFirst({
            where: {
                templateId,
                vocabHash,
                expiresAt: { gt: new Date() },
            },
        });

        if (cached) {
            // Increment usage and return cached
            await this.prisma.generatedScene.update({
                where: { id: cached.id },
                data: { usageCount: { increment: 1 } },
            });
            return cached;
        }

        // Inject vocabulary into dialog flow
        const injectedDialogFlow = this.injectVocab(
            template.dialogFlow as object,
            vocabSlots,
        );

        // Create new generated scene
        const scene = await this.prisma.generatedScene.create({
            data: {
                templateId,
                vocabHash,
                dialogFlow: injectedDialogFlow,
                injectedVocab: vocabSlots as object,
                isAIGenerated: false,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        return scene;
    }

    /**
     * Save user's scene completion history
     */
    async saveHistory(
        userId: string,
        templateId: string,
        sceneId: string | null,
        score: number,
        choicesMade: object,
        vocabUsed: string[],
    ): Promise<UserSceneHistory> {
        return this.prisma.userSceneHistory.create({
            data: {
                userId,
                templateId,
                sceneId,
                score,
                choicesMade,
                vocabUsed,
            },
        });
    }

    /**
     * Get user's scene history
     */
    async getUserHistory(userId: string, limit = 20): Promise<UserSceneHistory[]> {
        return this.prisma.userSceneHistory.findMany({
            where: { userId },
            include: {
                template: true,
            },
            orderBy: { completedAt: 'desc' },
            take: limit,
        });
    }

    /**
     * Get user's scene stats
     */
    async getUserStats(userId: string) {
        const [totalCompleted, avgScore, recentScenes] = await Promise.all([
            this.prisma.userSceneHistory.count({
                where: { userId },
            }),
            this.prisma.userSceneHistory.aggregate({
                where: { userId, score: { not: null } },
                _avg: { score: true },
            }),
            this.prisma.userSceneHistory.findMany({
                where: { userId },
                orderBy: { completedAt: 'desc' },
                take: 5,
                include: { template: true },
            }),
        ]);

        return {
            totalCompleted,
            averageScore: Math.round(avgScore._avg.score || 0),
            recentScenes,
        };
    }

    /**
     * Hash vocabulary for caching key
     */
    private hashVocab(vocabSlots: VocabSlots): string {
        const sortedKeys = Object.keys(vocabSlots).sort();
        const values = sortedKeys.map(k => vocabSlots[k].hanzi).join('|');
        return crypto.createHash('md5').update(values).digest('hex');
    }

    /**
     * Inject vocabulary into dialog flow
     * Replaces {slot_name} placeholders with actual vocab
     */
    private injectVocab(dialogFlow: object, vocabSlots: VocabSlots): object {
        const json = JSON.stringify(dialogFlow);

        let result = json;
        for (const [slot, vocab] of Object.entries(vocabSlots)) {
            // Replace {slot} with hanzi
            result = result.replace(new RegExp(`\\{${slot}\\}`, 'g'), vocab.hanzi);
        }

        return JSON.parse(result);
    }

    /**
     * Get random vocabulary from user's notebook for scene generation
     * Returns vocab items that can be used in scenes
     */
    async getRandomVocabForScene(userId: string, count = 3): Promise<VocabItem[]> {
        // Get user's vocabulary with vocabulary details
        const userVocab = await this.prisma.userVocabulary.findMany({
            where: { userId },
            include: {
                vocabulary: true,
            },
            take: 50, // Get last 50 saved words
            orderBy: { savedAt: 'desc' },
        });

        if (userVocab.length === 0) {
            // Return default vocab if user has none
            return [
                { hanzi: '咖啡', pinyin: 'kāfēi', meaningVi: 'cà phê' },
                { hanzi: '谢谢', pinyin: 'xièxiè', meaningVi: 'cảm ơn' },
                { hanzi: '你好', pinyin: 'nǐ hǎo', meaningVi: 'xin chào' },
            ].slice(0, count);
        }

        // Shuffle and pick random items
        const shuffled = userVocab.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(count, shuffled.length));

        return selected.map((uv) => ({
            hanzi: uv.vocabulary.hanzi,
            pinyin: uv.vocabulary.pinyin || '',
            meaningVi: uv.vocabulary.meaningVi || uv.vocabulary.meaningEn || '',
        }));
    }

    /**
     * Get vocabulary suggestions for a specific scenario type
     */
    async getVocabSuggestionsForScenario(
        userId: string,
        scenarioType: string,
        count = 5,
    ): Promise<VocabItem[]> {
        // Map scenario types to related vocabulary categories/keywords
        const scenarioKeywords: Record<string, string[]> = {
            coffee_shop: ['咖啡', '茶', '饮料', '喝', '杯', '热', '冰', '牛奶'],
            restaurant: ['吃', '饭', '菜', '点', '好吃', '辣', '肉', '鸡'],
            taxi: ['去', '到', '站', '机场', '分钟', '块', '钱', '停'],
            shopping: ['买', '卖', '便宜', '贵', '多少', '钱', '要', '块'],
            hotel: ['住', '房间', '晚', '早餐', '楼', '号', '护照', '钥匙'],
        };

        const keywords = scenarioKeywords[scenarioType] || [];

        // Try to find user vocab matching keywords
        const userVocab = await this.prisma.userVocabulary.findMany({
            where: {
                userId,
                vocabulary: {
                    hanzi: {
                        in: keywords,
                    },
                },
            },
            include: {
                vocabulary: true,
            },
        });

        // If found matching vocab, return it
        if (userVocab.length > 0) {
            return userVocab.slice(0, count).map((uv) => ({
                hanzi: uv.vocabulary.hanzi,
                pinyin: uv.vocabulary.pinyin || '',
                meaningVi: uv.vocabulary.meaningVi || uv.vocabulary.meaningEn || '',
            }));
        }

        // Otherwise return random vocab from user's notebook
        return this.getRandomVocabForScene(userId, count);
    }
}

