import { Injectable } from '@nestjs/common';

export interface StrokeData {
    character: string;
    strokes: string[];  // SVG path data for each stroke
    medians: number[][][];  // Median points for animation
}

export interface Decomposition {
    radical: { char: string; meaning: string; pinyin?: string };
    components: { char: string; meaning: string; pinyin?: string }[];
}

export interface Mnemonic {
    visualStory: string;      // Visual memory aid
    soundAssociation?: string; // Sound-based association
    characterBreakdown?: string; // Component-based explanation
}

export interface RelatedWords {
    synonyms: { hanzi: string; pinyin: string; meaning: string }[];
    antonyms: { hanzi: string; pinyin: string; meaning: string }[];
    collocations: { hanzi: string; pinyin: string; meaning: string }[];
}

export interface EnrichedWordData {
    hanzi: string;
    strokeData?: StrokeData;
    decomposition?: Decomposition;
    mnemonic?: Mnemonic;
    relatedWords?: RelatedWords;
    hskLevel?: number;
    frequencyRank?: number;
}

// Common radicals with meanings (cached static data)
const RADICALS_DATA: Record<string, { meaning: string; pinyin: string }> = {
    '人': { meaning: 'người', pinyin: 'rén' },
    '亻': { meaning: 'người (viết tắt)', pinyin: 'rén' },
    '口': { meaning: 'miệng', pinyin: 'kǒu' },
    '心': { meaning: 'tim, tâm', pinyin: 'xīn' },
    '忄': { meaning: 'tim (viết tắt)', pinyin: 'xīn' },
    '手': { meaning: 'tay', pinyin: 'shǒu' },
    '扌': { meaning: 'tay (viết tắt)', pinyin: 'shǒu' },
    '水': { meaning: 'nước', pinyin: 'shuǐ' },
    '氵': { meaning: 'nước (viết tắt)', pinyin: 'shuǐ' },
    '火': { meaning: 'lửa', pinyin: 'huǒ' },
    '灬': { meaning: 'lửa (viết tắt)', pinyin: 'huǒ' },
    '日': { meaning: 'mặt trời, ngày', pinyin: 'rì' },
    '月': { meaning: 'mặt trăng, tháng', pinyin: 'yuè' },
    '木': { meaning: 'cây gỗ', pinyin: 'mù' },
    '女': { meaning: 'nữ, phụ nữ', pinyin: 'nǚ' },
    '子': { meaning: 'con, đứa trẻ', pinyin: 'zǐ' },
    '目': { meaning: 'mắt', pinyin: 'mù' },
    '言': { meaning: 'lời nói', pinyin: 'yán' },
    '讠': { meaning: 'lời (viết tắt)', pinyin: 'yán' },
    '金': { meaning: 'vàng, kim loại', pinyin: 'jīn' },
    '钅': { meaning: 'kim loại (viết tắt)', pinyin: 'jīn' },
    '土': { meaning: 'đất', pinyin: 'tǔ' },
    '山': { meaning: 'núi', pinyin: 'shān' },
    '石': { meaning: 'đá', pinyin: 'shí' },
    '田': { meaning: 'ruộng', pinyin: 'tián' },
    '雨': { meaning: 'mưa', pinyin: 'yǔ' },
    '风': { meaning: 'gió', pinyin: 'fēng' },
    '食': { meaning: 'thức ăn', pinyin: 'shí' },
    '饣': { meaning: 'thức ăn (viết tắt)', pinyin: 'shí' },
    '马': { meaning: 'ngựa', pinyin: 'mǎ' },
    '鸟': { meaning: 'chim', pinyin: 'niǎo' },
    '足': { meaning: 'chân', pinyin: 'zú' },
    '走': { meaning: 'đi', pinyin: 'zǒu' },
    '门': { meaning: 'cửa', pinyin: 'mén' },
    '车': { meaning: 'xe', pinyin: 'chē' },
    '大': { meaning: 'lớn', pinyin: 'dà' },
    '小': { meaning: 'nhỏ', pinyin: 'xiǎo' },
    '中': { meaning: 'giữa', pinyin: 'zhōng' },
    '上': { meaning: 'trên', pinyin: 'shàng' },
    '下': { meaning: 'dưới', pinyin: 'xià' },
};

@Injectable()
export class WordEnrichmentService {
    private readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    private readonly HANZI_WRITER_DATA_URL = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0';
    private readonly MAX_RETRIES = 3;

    // In-memory cache for enriched data
    private cache: Map<string, { data: EnrichedWordData; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Call Gemini API with exponential backoff retry for 429 errors
     */
    private async callWithRetry(url: string, options: RequestInit, retryCount = 0): Promise<Response> {
        const response = await fetch(url, options);

        if (response.status === 429 && retryCount < this.MAX_RETRIES) {
            const delayMs = Math.pow(2, retryCount + 1) * 1000; // 2s, 4s, 8s
            console.log(`[Gemini] Rate limited, retrying in ${delayMs / 1000}s... (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return this.callWithRetry(url, options, retryCount + 1);
        }

        return response;
    }

    /**
     * Get enriched data for a Chinese character/word
     */
    async getEnrichedData(hanzi: string, pinyin?: string, meaning?: string): Promise<EnrichedWordData> {
        // Check cache first
        const cached = this.cache.get(hanzi);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }

        const result: EnrichedWordData = { hanzi };

        // Only fetch static data, skip AI generation for mnemonics and related words
        const [strokeData, decomposition] = await Promise.all([
            this.getStrokeData(hanzi).catch(() => undefined),
            this.getDecomposition(hanzi).catch(() => undefined),
        ]);

        const mnemonic = undefined;
        const relatedWords = undefined;

        result.strokeData = strokeData;
        result.decomposition = decomposition;
        result.mnemonic = mnemonic;
        result.relatedWords = relatedWords;

        // Cache the result
        this.cache.set(hanzi, { data: result, timestamp: Date.now() });

        return result;
    }

    /**
     * Fetch stroke order data from HanziWriter CDN
     */
    private async getStrokeData(hanzi: string): Promise<StrokeData | undefined> {
        // Only for single characters
        if (hanzi.length !== 1) return undefined;

        try {
            // Use URL-encoded character name (not charCode)
            const url = `${this.HANZI_WRITER_DATA_URL}/${encodeURIComponent(hanzi)}.json`;

            const response = await fetch(url);
            if (!response.ok) {
                console.log(`[StrokeData] No data for ${hanzi}`);
                return undefined;
            }

            const data = await response.json();
            return {
                character: hanzi,
                strokes: data.strokes || [],
                medians: data.medians || [],
            };
        } catch (error) {
            console.error('[StrokeData] Error fetching:', error);
            return undefined;
        }
    }

    /**
     * Get character decomposition (radical + components)
     */
    private async getDecomposition(hanzi: string): Promise<Decomposition | undefined> {
        if (hanzi.length !== 1) return undefined;

        // Use static radical data for common radicals
        const radicalInfo = RADICALS_DATA[hanzi];
        if (radicalInfo) {
            return {
                radical: { char: hanzi, ...radicalInfo },
                components: [],
            };
        }

        // For other characters, try to identify the radical
        // This is a simplified approach - a full implementation would use IDS data
        const commonRadicals = Object.keys(RADICALS_DATA);
        const foundRadical = commonRadicals.find(r => {
            // Check if this character might contain this radical
            // This is heuristic - proper implementation needs Unicode data
            return false; // Placeholder - would need proper decomposition data
        });

        // Return basic info - components would need proper IDS parsing
        return {
            radical: { char: hanzi, meaning: '', pinyin: '' },
            components: [],
        };
    }

    /**
     * Generate mnemonic using Gemini AI
     */
    private async generateMnemonic(hanzi: string, pinyin: string, meaning: string): Promise<Mnemonic | undefined> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.log('[Mnemonic] No API key, using fallback');
            return this.getFallbackMnemonic(hanzi, pinyin, meaning);
        }

        const prompt = `Bạn là giáo viên tiếng Trung sáng tạo. Tạo GỢI Ý NHỚ cho từ "${hanzi}" (${pinyin}) nghĩa "${meaning}".

YÊU CẦU:
- Ngắn gọn, dễ nhớ (tối đa 2-3 câu)
- Dùng liên tưởng hình ảnh hoặc âm thanh
- Nếu là chữ ghép, giải thích các thành phần

Trả về JSON (không markdown):
{"visualStory":"...", "characterBreakdown":"..."}

Ví dụ cho 好 (hǎo):
{"visualStory":"Chữ 好 gồm 女(nữ) + 子(con) = mẹ bế con = điều TỐT ĐẸP nhất","characterBreakdown":"女 (nữ) + 子 (con)"}`;

        try {
            console.log(`[Mnemonic] Generating for ${hanzi}...`);
            const response = await this.callWithRetry(`${this.GEMINI_API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.8, maxOutputTokens: 1000 },
                }),
            });

            if (!response.ok) {
                console.log('[Mnemonic] API error:', response.status, await response.text().catch(() => ''));
                return this.getFallbackMnemonic(hanzi, pinyin, meaning);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log('[Mnemonic] Raw response:', text);

            if (text) {
                // Clean markdown code blocks and extract JSON
                let cleanText = text;
                // Remove ```json and ``` markers
                cleanText = cleanText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

                const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const parsed = JSON.parse(jsonMatch[0]) as Mnemonic;
                        console.log('[Mnemonic] Parsed successfully');
                        return parsed;
                    } catch (e) {
                        console.log('[Mnemonic] JSON parse error:', e);
                    }
                }

                // If no JSON found, extract and clean the text for visualStory
                if (cleanText.length > 10) {
                    console.log('[Mnemonic] Using plain text as visualStory');

                    // Extract visualStory content if partial JSON
                    let story = cleanText;
                    const visualStoryMatch = cleanText.match(/"visualStory"\s*:\s*"([^"]+)/i);
                    if (visualStoryMatch) {
                        story = visualStoryMatch[1];
                    }

                    // Clean up JSON syntax and markdown formatting
                    story = story
                        .replace(/[{}"\[\]]/g, '')           // Remove JSON characters
                        .replace(/\*\*/g, '')                 // Remove markdown bold
                        .replace(/\*/g, '')                   // Remove markdown italic
                        .replace(/visualStory\s*:\s*/gi, '')  // Remove field name
                        .replace(/characterBreakdown\s*:\s*/gi, '')
                        .replace(/\\n/g, ' ')                 // Replace escaped newlines
                        .replace(/\s+/g, ' ')                 // Normalize spaces
                        .trim();

                    if (story.length > 10) {
                        return {
                            visualStory: story,
                            characterBreakdown: hanzi.length > 1 ? hanzi.split('').join(' + ') : undefined,
                        };
                    }
                }
            }
            console.log('[Mnemonic] Could not parse, using fallback');
            return this.getFallbackMnemonic(hanzi, pinyin, meaning);
        } catch (error) {
            console.error('[Mnemonic] Error:', error);
            return this.getFallbackMnemonic(hanzi, pinyin, meaning);
        }
    }

    /**
     * Fallback mnemonic when API fails
     */
    private getFallbackMnemonic(hanzi: string, pinyin: string, meaning: string): Mnemonic {
        return {
            visualStory: `Chữ "${hanzi}" (${pinyin}) có nghĩa là "${meaning}". Hãy liên tưởng hình dạng chữ với nghĩa để dễ nhớ hơn.`,
            characterBreakdown: hanzi.length > 1 ? hanzi.split('').join(' + ') : undefined,
        };
    }

    /**
     * Generate related words using Gemini AI
     */
    private async generateRelatedWords(hanzi: string, pinyin: string, meaning: string): Promise<RelatedWords | undefined> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.log('[RelatedWords] No API key');
            return undefined;
        }

        const prompt = `Cho từ tiếng Trung "${hanzi}" (${pinyin}) nghĩa "${meaning}".
Liệt kê TỐI ĐA 2 từ mỗi loại (HSK 1-4):

1. Từ đồng nghĩa
2. Từ trái nghĩa  
3. Cụm từ thường đi kèm

JSON format (không markdown):
{"synonyms":[{"hanzi":"...","pinyin":"...","meaning":"..."}],"antonyms":[...],"collocations":[...]}

Nếu không có, để mảng rỗng [].`;

        try {
            console.log(`[RelatedWords] Generating for ${hanzi}...`);
            const response = await this.callWithRetry(`${this.GEMINI_API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.5, maxOutputTokens: 1500 },
                }),
            });

            if (!response.ok) {
                console.log('[RelatedWords] API error:', response.status);
                return undefined;
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log('[RelatedWords] Response length:', text?.length);

            if (text) {
                // Clean markdown code blocks
                let cleanText = text;
                cleanText = cleanText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

                let jsonMatch = cleanText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    let jsonStr = jsonMatch[0];

                    // Try to repair truncated JSON
                    try {
                        return JSON.parse(jsonStr) as RelatedWords;
                    } catch (e) {
                        console.log('[RelatedWords] Attempting JSON repair...');
                        // Count brackets and try to close them
                        const openBrackets = (jsonStr.match(/\[/g) || []).length;
                        const closeBrackets = (jsonStr.match(/\]/g) || []).length;
                        const openBraces = (jsonStr.match(/\{/g) || []).length;
                        const closeBraces = (jsonStr.match(/\}/g) || []).length;

                        // Remove trailing incomplete entry
                        jsonStr = jsonStr.replace(/,\s*\{[^}]*$/, '');
                        jsonStr = jsonStr.replace(/,\s*"[^"]*$/, '');

                        // Close unclosed brackets
                        for (let i = 0; i < openBrackets - closeBrackets; i++) jsonStr += ']';
                        for (let i = 0; i < openBraces - closeBraces; i++) jsonStr += '}';

                        try {
                            const repaired = JSON.parse(jsonStr) as RelatedWords;
                            console.log('[RelatedWords] Repaired successfully');
                            return repaired;
                        } catch (e2) {
                            console.log('[RelatedWords] Repair failed');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[RelatedWords] Error:', error);
        }

        return undefined;
    }
}
