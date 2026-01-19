import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

export interface VocabItem {
    hanzi: string;
    pinyin: string;
    meaningVi: string;
}

interface DialogNode {
    speaker: string;
    speakerVi: string;
    text: string;
    textVi: string;
    pinyin: string;
    choices?: DialogChoice[];
    isEnd?: boolean;
    score?: number;
}

interface DialogChoice {
    id: string;
    text: string;
    textVi: string;
    next: string;
    correct?: boolean;
}

export interface DialogFlow {
    [nodeId: string]: DialogNode;
}

interface GenerateSceneRequest {
    scenarioType: string; // coffee_shop, restaurant, taxi, etc.
    vocabularyToUse: VocabItem[];
    hskLevel: number;
    userId: string;
}

@Injectable()
export class AiSceneService {
    private readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    private readonly DAILY_LIMIT = 3; // Free tier limit per user per day
    private readonly MAX_RETRIES = 3;

    constructor(private prisma: PrismaService) { }

    /**
     * Call Gemini API with exponential backoff retry for 429 errors
     */
    private async callWithRetry(url: string, options: RequestInit, retryCount = 0): Promise<Response> {
        const response = await fetch(url, options);

        if (response.status === 429 && retryCount < this.MAX_RETRIES) {
            const delayMs = Math.pow(2, retryCount + 1) * 1000; // 2s, 4s, 8s
            console.log(`[AI Scene] Rate limited, retrying in ${delayMs / 1000}s... (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return this.callWithRetry(url, options, retryCount + 1);
        }

        return response;
    }

    /**
     * Check if user can generate more AI scenes today
     */
    async checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayCount = await this.prisma.generatedScene.count({
            where: {
                isAIGenerated: true,
                createdAt: {
                    gte: today,
                    lt: tomorrow,
                },
                userHistory: {
                    some: { userId },
                },
            },
        });

        return {
            allowed: todayCount < this.DAILY_LIMIT,
            remaining: Math.max(0, this.DAILY_LIMIT - todayCount),
            resetAt: tomorrow,
        };
    }

    /**
     * Generate a custom scene using Gemini AI
     */
    async generateScene(request: GenerateSceneRequest): Promise<DialogFlow> {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.warn('[AI Scene] GEMINI_API_KEY not set, using fallback');
            return this.getFallbackScene(request.scenarioType);
        }

        // Check rate limit
        const rateLimit = await this.checkRateLimit(request.userId);
        if (!rateLimit.allowed) {
            throw new BadRequestException(
                `Bạn đã hết lượt tạo scene AI hôm nay (${this.DAILY_LIMIT}/ngày). Thử lại sau ${rateLimit.resetAt.toLocaleTimeString('vi-VN')}`
            );
        }

        const vocabList = request.vocabularyToUse
            .map(v => `${v.hanzi} (${v.pinyin}) - ${v.meaningVi}`)
            .join('\n');

        const prompt = `You are an expert Chinese language teacher creating an interactive dialogue scene for Vietnamese learners.

Create a branching dialogue scene for: "${request.scenarioType}"
HSK Level: ${request.hskLevel}
Target Vocabulary to include:
${vocabList || '(Use common vocabulary for this scenario)'}

Requirements:
1. Create a realistic conversation with 4-6 dialogue nodes
2. Each node should have 2-3 response choices for the learner
3. Include pinyin and Vietnamese translations for everything
4. Mark correct/natural responses with "correct: true"
5. End with a success node that has isEnd: true and score: 100

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "start": {
    "speaker": "服务员",
    "speakerVi": "Nhân viên",
    "text": "你好！欢迎光临！",
    "textVi": "Xin chào! Chào mừng quý khách!",
    "pinyin": "Nǐ hǎo! Huānyíng guānglín!",
    "choices": [
      { "id": "a", "text": "你好！", "textVi": "Xin chào!", "next": "node2", "correct": true },
      { "id": "b", "text": "...", "textVi": "...", "next": "node2" }
    ]
  },
  "node2": { ... },
  "end_success": {
    "speaker": "...",
    "speakerVi": "...",
    "text": "...",
    "textVi": "...",
    "pinyin": "...",
    "isEnd": true,
    "score": 100
  }
}`;

        try {
            console.log('[AI Scene] Generating scene for:', request.scenarioType);

            const response = await this.callWithRetry(`${this.GEMINI_API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 4096,
                    },
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[AI Scene] Gemini API error:', response.status, errorText);
                return this.getFallbackScene(request.scenarioType);
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                console.warn('[AI Scene] No text in Gemini response');
                return this.getFallbackScene(request.scenarioType);
            }

            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const dialogFlow = JSON.parse(jsonMatch[0]) as DialogFlow;
                console.log('[AI Scene] Successfully generated scene with', Object.keys(dialogFlow).length, 'nodes');
                return dialogFlow;
            }

            console.warn('[AI Scene] Could not parse JSON from response');
            return this.getFallbackScene(request.scenarioType);

        } catch (error) {
            console.error('[AI Scene] Failed to generate scene:', error);
            return this.getFallbackScene(request.scenarioType);
        }
    }

    /**
     * Save generated scene to database with caching
     */
    async saveGeneratedScene(
        dialogFlow: DialogFlow,
        vocabularyUsed: VocabItem[],
        userId: string,
        templateId?: string,
    ) {
        const vocabHash = this.hashVocab(vocabularyUsed);

        const scene = await this.prisma.generatedScene.create({
            data: {
                templateId,
                vocabHash,
                dialogFlow: dialogFlow as object,
                injectedVocab: vocabularyUsed as object[],
                isAIGenerated: true,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        // Also create history entry to track usage
        await this.prisma.userSceneHistory.create({
            data: {
                userId,
                sceneId: scene.id,
                templateId,
                vocabUsed: vocabularyUsed.map(v => v.hanzi),
            },
        });

        return scene;
    }

    /**
     * Get cached scene if exists
     */
    async getCachedScene(vocabularyUsed: VocabItem[]): Promise<DialogFlow | null> {
        const vocabHash = this.hashVocab(vocabularyUsed);

        const cached = await this.prisma.generatedScene.findFirst({
            where: {
                vocabHash,
                isAIGenerated: true,
                expiresAt: { gt: new Date() },
            },
            orderBy: { usageCount: 'desc' },
        });

        if (cached) {
            // Increment usage count
            await this.prisma.generatedScene.update({
                where: { id: cached.id },
                data: { usageCount: { increment: 1 } },
            });
            return cached.dialogFlow as unknown as DialogFlow;
        }

        return null;
    }

    /**
     * Hash vocabulary for caching key
     */
    private hashVocab(vocab: VocabItem[]): string {
        const sorted = [...vocab].sort((a, b) => a.hanzi.localeCompare(b.hanzi));
        const values = sorted.map(v => v.hanzi).join('|');
        return crypto.createHash('md5').update(values).digest('hex');
    }

    /**
     * Fallback scene when AI generation fails
     */
    private getFallbackScene(scenarioType: string): DialogFlow {
        // Return a simple fallback based on scenario type
        const fallbacks: Record<string, DialogFlow> = {
            coffee_shop: {
                start: {
                    speaker: '服务员',
                    speakerVi: 'Nhân viên',
                    text: '你好！想喝点什么？',
                    textVi: 'Xin chào! Bạn muốn uống gì?',
                    pinyin: 'Nǐ hǎo! Xiǎng hē diǎn shénme?',
                    choices: [
                        { id: 'a', text: '一杯咖啡。', textVi: 'Một ly cà phê.', next: 'end', correct: true },
                    ],
                },
                end: {
                    speaker: '服务员',
                    speakerVi: 'Nhân viên',
                    text: '好的！请稍等。',
                    textVi: 'Được! Xin đợi một chút.',
                    pinyin: 'Hǎo de! Qǐng shāo děng.',
                    isEnd: true,
                    score: 100,
                },
            },
            restaurant: {
                start: {
                    speaker: '服务员',
                    speakerVi: 'Nhân viên',
                    text: '欢迎光临！几位？',
                    textVi: 'Chào mừng! Mấy người?',
                    pinyin: 'Huānyíng guānglín! Jǐ wèi?',
                    choices: [
                        { id: 'a', text: '两位。', textVi: 'Hai người.', next: 'end', correct: true },
                    ],
                },
                end: {
                    speaker: '服务员',
                    speakerVi: 'Nhân viên',
                    text: '请跟我来。',
                    textVi: 'Mời đi theo tôi.',
                    pinyin: 'Qǐng gēn wǒ lái.',
                    isEnd: true,
                    score: 100,
                },
            },
        };

        return fallbacks[scenarioType] || fallbacks.coffee_shop;
    }
}
