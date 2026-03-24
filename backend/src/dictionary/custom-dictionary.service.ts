import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DictionaryEntry {
    id?: string;
    hanzi: string;
    pinyin: string;
    pinyinDisplay: string;
    meaningVi: string;
    meaningEn?: string;
    radical?: string;
    radicalMeaning?: string;
    strokeCount?: number;
    partOfSpeech?: string;
    hskLevel?: number;
    examples?: { chinese: string; pinyin?: string; vietnamese: string }[];
    synonyms?: { hanzi: string; pinyin: string; meaningVi: string }[];
    antonyms?: { hanzi: string; pinyin: string; meaningVi: string }[];
    mnemonic?: string;
    found: boolean;
    // New fields for centralized system
    source: 'db' | 'ai';
    isSystemWord: boolean;
}

export interface LookupResult {
    hanzi: string;
    pinyin: string;
    pinyinDisplay: string;
    meaningVi: string;
    meaningEn?: string;
    radical?: string;
    radicalMeaning?: string;
    strokeCount?: number;
    partOfSpeech?: string;
    hskLevel?: number;
    examples?: { chinese: string; pinyin?: string; vietnamese: string }[];
    synonyms?: { hanzi: string; pinyin: string; meaningVi: string }[];
    antonyms?: { hanzi: string; pinyin: string; meaningVi: string }[];
    mnemonic?: string;
    found: boolean;
    // New fields for centralized system
    source: 'db' | 'ai';
    isSystemWord: boolean;
    id?: string;
    // For multi-character breakdown
    allEntries?: DictionaryEntry[];
}

// LRU Cache for AI results
interface AICacheEntry {
    data: LookupResult;
    timestamp: number;
}

/**
 * Custom Dictionary Service
 * Uses local vocabulary database as primary source
 * Falls back to AI (Gemini) for words not in system
 */
@Injectable()
export class CustomDictionaryService {
    private readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    private readonly MAX_RETRIES = 2;

    // In-memory LRU cache for AI-generated definitions
    private readonly aiCache = new Map<string, AICacheEntry>();
    private readonly AI_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
    private readonly MAX_AI_CACHE_SIZE = 500;

    constructor(private prisma: PrismaService) {
        console.log('CustomDictionaryService initialized (Centralized Mode)');
    }

    /**
     * Transform database vocabulary to API response format
     */
    private transformToEntry(vocab: any): DictionaryEntry {
        return {
            id: vocab.id,
            hanzi: vocab.hanzi,
            pinyin: vocab.pinyin,
            pinyinDisplay: vocab.pinyin,
            meaningVi: vocab.meaningVi,
            meaningEn: vocab.meaningEn,
            radical: vocab.radical,
            radicalMeaning: vocab.radicalMeaning,
            strokeCount: vocab.strokeCount,
            partOfSpeech: vocab.partOfSpeech,
            hskLevel: vocab.hskLevel,
            examples: this.splitCompoundExamples(vocab.examples as any[] || []),
            synonyms: vocab.synonyms as any[] || [],
            antonyms: vocab.antonyms as any[] || [],
            mnemonic: vocab.mnemonic,
            found: true,
            source: 'db',
            isSystemWord: true,
        };
    }

    /**
     * Smart lookup - main entry point for dictionary queries
     * Priority: DB (exact → compound → breakdown → fuzzy) → AI fallback
     */
    async lookup(hanzi: string, contextPinyin?: string): Promise<LookupResult> {
        try {
            // === STEP 1: Try to find in database ===

            // Level 1: Exact match
            const exact = await this.prisma.vocabulary.findUnique({
                where: { hanzi },
            });

            if (exact) {
                const entry = this.transformToEntry(exact);
                return {
                    ...entry,
                    allEntries: [entry],
                };
            }


            // Level 3: Fuzzy search by pinyin
            if (contextPinyin) {
                const pinyinSearch = contextPinyin.toLowerCase().replace(/[0-9]/g, '');
                const fuzzyResults = await this.prisma.vocabulary.findMany({
                    where: {
                        pinyin: { contains: pinyinSearch, mode: 'insensitive' },
                    },
                    take: 5,
                });

                if (fuzzyResults.length > 0) {
                    const entries = fuzzyResults.map(v => this.transformToEntry(v));
                    const first = entries[0];
                    return {
                        ...first,
                        hanzi,
                        allEntries: entries,
                    };
                }
            }

            // === STEP 2: Not found in DB ===
            console.log(`[Dictionary] "${hanzi}" not found in DB`);
            return this.createNotFoundResult(hanzi);

        } catch (error) {
            console.error('CustomDictionary lookup error:', error);
            return this.createNotFoundResult(hanzi);
        }
    }

    /**
     * Generate definition using Gemini AI
     * Results are cached to reduce API calls
     */
    private async generateWithAI(hanzi: string): Promise<LookupResult> {
        // Check cache first
        const cached = this.getFromAICache(hanzi);
        if (cached) {
            console.log(`[Dictionary AI] Cache hit for: ${hanzi}`);
            return cached;
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.warn('[Dictionary AI] GEMINI_API_KEY not set');
            return this.createNotFoundResult(hanzi);
        }

        const prompt = `Bạn là từ điển Trung-Việt. Dịch từ/cụm từ tiếng Trung: "${hanzi}"

Trả về JSON (KHÔNG markdown):
{
  "pinyin": "pinyin có dấu thanh",
  "meaningVi": "nghĩa tiếng Việt (ngắn gọn)",
  "partOfSpeech": "loại từ (noun/verb/adj...)",
  "example": {
    "chinese": "câu ví dụ tiếng Trung",
    "pinyin": "pinyin câu ví dụ",
    "vietnamese": "dịch tiếng Việt"
  }
}

Nếu không phải từ tiếng Trung hợp lệ, trả về: {"error": true}`;

        try {
            const response = await this.callGeminiWithRetry(apiKey, prompt);

            if (!response.ok) {
                console.error('[Dictionary AI] API error:', response.status);
                return this.createNotFoundResult(hanzi);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                return this.createNotFoundResult(hanzi);
            }

            // Parse JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return this.createNotFoundResult(hanzi);
            }

            const parsed = JSON.parse(jsonMatch[0]);

            if (parsed.error) {
                return this.createNotFoundResult(hanzi);
            }

            const result: LookupResult = {
                hanzi,
                pinyin: parsed.pinyin || '',
                pinyinDisplay: parsed.pinyin || '',
                meaningVi: parsed.meaningVi || '',
                partOfSpeech: parsed.partOfSpeech,
                examples: parsed.example ? [parsed.example] : [],
                found: true,
                source: 'ai',
                isSystemWord: false, // Cannot be saved by user
            };

            // Cache the result
            this.saveToAICache(hanzi, result);

            console.log(`[Dictionary AI] Generated definition for: ${hanzi}`);
            return result;

        } catch (error) {
            console.error('[Dictionary AI] Failed to generate:', error);
            return this.createNotFoundResult(hanzi);
        }
    }

    /**
     * Call Gemini API with retry logic
     */
    private async callGeminiWithRetry(apiKey: string, prompt: string, retryCount = 0): Promise<Response> {
        const response = await fetch(`${this.GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 500,
                },
            }),
        });

        if (response.status === 429 && retryCount < this.MAX_RETRIES) {
            const delayMs = Math.pow(2, retryCount + 1) * 1000;
            console.log(`[Dictionary AI] Rate limited, retrying in ${delayMs / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return this.callGeminiWithRetry(apiKey, prompt, retryCount + 1);
        }

        return response;
    }

    /**
     * Create a "not found" result with AI source marker
     */
    private createNotFoundResult(hanzi: string): LookupResult {
        return {
            hanzi,
            pinyin: '',
            pinyinDisplay: '',
            meaningVi: '',
            found: false,
            source: 'db',
            isSystemWord: false,
        };
    }

    // === AI Cache Management ===

    private getFromAICache(hanzi: string): LookupResult | null {
        const entry = this.aiCache.get(hanzi);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.AI_CACHE_TTL) {
            this.aiCache.delete(hanzi);
            return null;
        }

        // Move to end (LRU)
        this.aiCache.delete(hanzi);
        this.aiCache.set(hanzi, entry);
        return entry.data;
    }

    private saveToAICache(hanzi: string, result: LookupResult): void {
        if (this.aiCache.size >= this.MAX_AI_CACHE_SIZE) {
            const keysToDelete = Array.from(this.aiCache.keys()).slice(0, Math.floor(this.MAX_AI_CACHE_SIZE * 0.1));
            keysToDelete.forEach(k => this.aiCache.delete(k));
        }
        this.aiCache.set(hanzi, { data: result, timestamp: Date.now() });
    }

    // === Other Methods ===

    /**
     * Search vocabulary by query (only searches DB, not AI)
     */
    async search(query: string, limit = 20): Promise<LookupResult[]> {
        try {
            const results = await this.prisma.vocabulary.findMany({
                where: {
                    OR: [
                        { hanzi: { contains: query } },
                        { pinyin: { contains: query, mode: 'insensitive' } },
                        { meaningVi: { contains: query, mode: 'insensitive' } },
                        { meaningEn: { contains: query, mode: 'insensitive' } },
                    ],
                },
                take: limit,
                orderBy: [{ hskLevel: 'asc' }, { hanzi: 'asc' }],
            });

            return results.map(v => ({
                ...this.transformToEntry(v),
            }));
        } catch (error) {
            console.error('CustomDictionary search error:', error);
            return [];
        }
    }

    /**
     * Get examples for a vocabulary item
     */
    async getExamples(hanzi: string): Promise<{ chinese: string; pinyin?: string; vietnamese: string }[]> {
        try {
            const vocab = await this.prisma.vocabulary.findUnique({
                where: { hanzi },
                select: { examples: true },
            });

            if (vocab?.examples && Array.isArray(vocab.examples)) {
                return this.splitCompoundExamples(vocab.examples as any[]);
            }

            return [];
        } catch (error) {
            console.error('CustomDictionary getExamples error:', error);
            return [];
        }
    }

    /**
     * Get enriched data for word popover
     */
    async getEnrichedData(hanzi: string): Promise<{
        hanzi: string;
        radical?: string;
        radicalMeaning?: string;
        strokeCount?: number;
        synonyms?: any[];
        antonyms?: any[];
        mnemonic?: string;
        hskLevel?: number;
        isSystemWord: boolean;
    }> {
        try {
            const vocab = await this.prisma.vocabulary.findUnique({
                where: { hanzi },
                select: {
                    hanzi: true,
                    radical: true,
                    radicalMeaning: true,
                    strokeCount: true,
                    synonyms: true,
                    antonyms: true,
                    mnemonic: true,
                    hskLevel: true,
                },
            });

            if (!vocab) {
                return { hanzi, isSystemWord: false };
            }

            return {
                hanzi: vocab.hanzi,
                radical: vocab.radical || undefined,
                radicalMeaning: vocab.radicalMeaning || undefined,
                strokeCount: vocab.strokeCount || undefined,
                synonyms: vocab.synonyms as any[] || [],
                antonyms: vocab.antonyms as any[] || [],
                mnemonic: vocab.mnemonic || undefined,
                hskLevel: vocab.hskLevel,
                isSystemWord: true,
            };
        } catch (error) {
            console.error('CustomDictionary getEnrichedData error:', error);
            return { hanzi, isSystemWord: false };
        }
    }

    /**
     * Split merged examples into individual ones if they share a common separator
     */
    private splitCompoundExamples(examples: any[]): any[] {
        if (!examples || !Array.isArray(examples)) return [];

        const result: any[] = [];
        for (const ex of examples) {
            const chinese = (ex.chinese || '').trim();
            const pinyin = (ex.pinyin || '').trim();
            const vietnamese = (ex.vietnamese || ex.translation || '').trim();

            // Split by punctuation followed by space (lookbehind)
            const cParts = chinese.split(/(?<=[.。?!！？;；])\s+/).filter(Boolean);
            const pParts = pinyin.split(/(?<=[.。?!！？;；])\s+/).filter(Boolean);
            const vParts = vietnamese.split(/(?<=[.。?!！？;；])\s+/).filter(Boolean);

            // Only split if alignment matches perfectly across sessions
            if (cParts.length > 1 && cParts.length === pParts.length && cParts.length === vParts.length) {
                for (let i = 0; i < cParts.length; i++) {
                    result.push({
                        chinese: cParts[i],
                        pinyin: pParts[i],
                        vietnamese: vParts[i]
                    });
                }
            } else {
                // If only one field has multiple parts or alignment is off, keep as a single block
                result.push(ex);
            }
        }
        return result;
    }

    /**
     * Check if dictionary is ready
     */
    isDictionaryLoaded(): boolean {
        return true;
    }

    /**
     * Get dictionary status
     */
    async getStatus(): Promise<{ loaded: boolean; totalWords: number; aiCacheSize: number }> {
        const count = await this.prisma.vocabulary.count();
        return {
            loaded: true,
            totalWords: count,
            aiCacheSize: this.aiCache.size,
        };
    }
}
