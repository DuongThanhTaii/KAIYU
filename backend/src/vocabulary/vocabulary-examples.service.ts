import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ExampleSentence {
  hanzi: string;
  pinyin: string;
  meaningVi: string;
}

interface CacheEntry {
  data: ExampleSentence[];
  timestamp: number;
}

@Injectable()
export class VocabularyExamplesService {
  private readonly GEMINI_API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  private readonly MAX_RETRIES = 3;
  private readonly logger = new Logger(VocabularyExamplesService.name);

  // In-memory LRU cache for examples (no DB storage needed)
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
  private readonly MAX_CACHE_SIZE = 2000; // Max 2000 words cached

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttlHours: this.CACHE_TTL / (60 * 60 * 1000),
    };
  }

  /**
   * Check in-memory cache
   */
  private getFromCache(hanzi: string): ExampleSentence[] | null {
    const entry = this.cache.get(hanzi);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(hanzi);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(hanzi);
    this.cache.set(hanzi, entry);
    return entry.data;
  }

  /**
   * Save to in-memory cache
   */
  private saveToCache(hanzi: string, examples: ExampleSentence[]): void {
    // Clean oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const keysToDelete = Array.from(this.cache.keys()).slice(
        0,
        Math.floor(this.MAX_CACHE_SIZE * 0.1),
      );
      keysToDelete.forEach((k) => this.cache.delete(k));
      this.logger.debug(
        `[ExamplesCache] Cleaned ${keysToDelete.length} oldest entries`,
      );
    }

    this.cache.set(hanzi, { data: examples, timestamp: Date.now() });
  }

  /**
   * Call Gemini API with exponential backoff retry for 429 errors
   */
  private async callWithRetry(
    url: string,
    options: RequestInit,
    retryCount = 0,
  ): Promise<Response> {
    const response = await fetch(url, options);

    if (response.status === 429 && retryCount < this.MAX_RETRIES) {
      const delayMs = Math.pow(2, retryCount + 1) * 1000; // 2s, 4s, 8s
      this.logger.warn(
        `[Gemini] Rate limited, retrying in ${delayMs / 1000}s... (attempt ${retryCount + 1}/${this.MAX_RETRIES})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return this.callWithRetry(url, options, retryCount + 1);
    }

    return response;
  }

  /**
   * Get example sentences for a vocabulary word
   * Check DB first, generate with AI if not found
   */
  async getExamples(vocabularyId: string): Promise<ExampleSentence[]> {
    // 1. Check DB cache first
    const vocab = await this.prisma.vocabulary.findUnique({
      where: { id: vocabularyId },
      select: {
        id: true,
        hanzi: true,
        pinyin: true,
        meaningVi: true,
        meaningEn: true,
        examples: true,
      },
    });

    if (!vocab) {
      return [];
    }

    // 2. If examples exist in DB, return them
    if (
      vocab.examples &&
      Array.isArray(vocab.examples) &&
      vocab.examples.length > 0
    ) {
      return vocab.examples as unknown as ExampleSentence[];
    }

    // 3. Generate with AI
    const meaning = vocab.meaningVi || vocab.meaningEn || '';
    const examples = await this.generateExamples(
      vocab.hanzi,
      vocab.pinyin,
      meaning,
    );

    // 4. Save to DB for future
    if (examples.length > 0) {
      await this.prisma.vocabulary.update({
        where: { id: vocabularyId },
        data: { examples: examples as unknown as object[] },
      });
    }

    return examples;
  }

  /**
   * Get example sentences by Hanzi (for Dictionary lookup)
   * 1. Check in-memory cache first (fastest)
   * 2. Check if word exists in Vocabulary DB -> use cached/generate and save
   * 3. If not in DB -> generate only and cache in-memory
   */
  async getExamplesByHanzi(
    hanzi: string,
    pinyin?: string,
    meaning?: string,
  ): Promise<ExampleSentence[]> {
    // 1. Check in-memory cache first (fastest)
    const cached = this.getFromCache(hanzi);
    if (cached) {
      this.logger.debug(`[ExamplesCache] Hit for: ${hanzi}`);
      return cached;
    }
    this.logger.debug(`[ExamplesCache] Miss for: ${hanzi}`);

    // 2. Try to find in DB
    const vocab = await this.prisma.vocabulary.findUnique({
      where: { hanzi },
      select: { id: true, examples: true },
    });

    if (
      vocab?.examples &&
      Array.isArray(vocab.examples) &&
      vocab.examples.length > 0
    ) {
      const examples = vocab.examples as unknown as ExampleSentence[];
      this.saveToCache(hanzi, examples);
      return examples;
    }

    // 3. Generate with AI
    if (!pinyin || !meaning) {
      return this.getFallbackExamples(hanzi);
    }

    const examples = await this.generateExamples(hanzi, pinyin, meaning);

    // 4. Save to in-memory cache (not DB to save space)
    if (examples.length > 0) {
      this.saveToCache(hanzi, examples);
    }

    return examples;
  }

  /**
   * Generate example sentences using Gemini AI
   */
  private async generateExamples(
    hanzi: string,
    pinyin: string,
    meaning: string,
  ): Promise<ExampleSentence[]> {
    const apiKey = process.env.GEMINI_API_KEY;

    this.logger.debug(`[Gemini] Generating examples for: ${hanzi}`);
    this.logger.debug(`[Gemini] API Key exists: ${!!apiKey}`);

    if (!apiKey) {
      console.warn('[Gemini] GEMINI_API_KEY not set, using fallback examples');
      return this.getFallbackExamples(hanzi);
    }

    // List of diverse contexts to ensure variety
    const contexts = [
      'Đời sống hàng ngày (ăn uống, sinh hoạt)',
      'Công việc văn phòng',
      'Du lịch, khám phá',
      'Học tập, trường lớp',
      'Giao tiếp bạn bè',
      'Mua sắm, giá cả',
      'Giải trí, sở thích',
      'Công nghệ, internet',
      'Gia đình, người thân',
      'Tình cảm, cảm xúc',
      'Thể thao, sức khỏe',
      'Thời tiết, thiên nhiên',
    ];

    // Randomly select 3 unique contexts
    const selectedContexts = contexts
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const prompt = `Bạn là giáo viên tiếng Trung giàu kinh nghiệm. Hãy tạo 3 câu ví dụ THỰC TẾ và HỮU ÍCH cho từ "${hanzi}" (${pinyin}) nghĩa "${meaning}".

🎯 YÊU CẦU QUAN TRỌNG:
- Câu phải TỰ NHIÊN như người bản xứ nói hàng ngày
- KHÔNG dùng mẫu "我学习...这个词" 
- Mỗi câu phải có NGỮ CẢNH CỤ THỂ và Ý NGHĨA THỰC TẾ
- Độ khó: HSK 2-4 (không quá dễ, không quá khó)

📝 3 NGỮ CẢNH:
1. ${selectedContexts[0]}
2. ${selectedContexts[1]}  
3. ${selectedContexts[2]}

📌 FORMAT (chỉ trả về JSON, không markdown):
[{"hanzi":"câu tiếng Trung hoàn chỉnh","pinyin":"pinyin có dấu thanh","meaningVi":"dịch tiếng Việt tự nhiên"}]

Ví dụ tốt cho từ "喜欢":
[{"hanzi":"我很喜欢吃中国菜。","pinyin":"Wǒ hěn xǐhuān chī Zhōngguó cài.","meaningVi":"Tôi rất thích ăn món Trung Quốc."}]`;

    try {
      this.logger.debug('[Gemini] Calling API...');

      const response = await this.callWithRetry(
        `${this.GEMINI_API_URL}?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.9, // Higher for more creativity
              maxOutputTokens: 2000,
            },
          }),
        },
      );

      this.logger.debug(`[Gemini] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Gemini] API error:', response.status, errorText);
        return this.getFallbackExamples(hanzi);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      this.logger.debug(
        `[Gemini] Raw response text: ${text?.substring(0, 200)}`,
      );

      if (!text) {
        console.warn('[Gemini] No text in response');
        return this.getFallbackExamples(hanzi);
      }

      // Clean markdown code blocks and parse JSON
      let cleanText = text;
      // Remove ```json and ``` markers
      cleanText = cleanText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

      let jsonMatch = cleanText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];

        // Try to parse directly
        try {
          const examples = JSON.parse(jsonStr) as ExampleSentence[];
          this.logger.debug(
            `[Gemini] Successfully parsed ${examples.length} examples`,
          );
          return examples.slice(0, 3);
        } catch (e) {
          this.logger.debug('[Gemini] Attempting JSON repair for examples...');

          // Try to repair truncated JSON
          // Remove trailing incomplete entry
          jsonStr = jsonStr.replace(/,\s*\{[^}]*$/, '');
          jsonStr = jsonStr.replace(/,\s*"[^"]*$/, '');

          // Count and close brackets
          const openBrackets = (jsonStr.match(/\[/g) || []).length;
          const closeBrackets = (jsonStr.match(/\]/g) || []).length;
          const openBraces = (jsonStr.match(/\{/g) || []).length;
          const closeBraces = (jsonStr.match(/\}/g) || []).length;

          for (let i = 0; i < openBraces - closeBraces; i++) jsonStr += '}';
          for (let i = 0; i < openBrackets - closeBrackets; i++) jsonStr += ']';

          try {
            const repaired = JSON.parse(jsonStr) as ExampleSentence[];
            this.logger.debug(
              `[Gemini] Repaired examples, got ${repaired.length} items`,
            );
            return repaired.filter((ex) => ex.hanzi && ex.pinyin).slice(0, 3);
          } catch (e2) {
            console.warn('[Gemini] Repair failed');
          }
        }
      }

      console.warn('[Gemini] Could not parse JSON from response');
      return this.getFallbackExamples(hanzi);
    } catch (error) {
      console.error('[Gemini] Failed to generate examples:', error);
      return this.getFallbackExamples(hanzi);
    }
  }

  /**
   * Fallback examples when AI is not available
   */
  private getFallbackExamples(hanzi: string): ExampleSentence[] {
    return [
      {
        hanzi: `我学习"${hanzi}"这个词。`,
        pinyin: `Wǒ xuéxí "${hanzi}" zhège cí.`,
        meaningVi: `Tôi học từ "${hanzi}" này.`,
      },
    ];
  }
}
