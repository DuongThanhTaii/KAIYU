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
  private readonly GEMINI_API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  private readonly MAX_RETRIES = 2;

  // In-memory LRU cache for AI-generated definitions
  private readonly aiCache = new Map<string, AICacheEntry>();
  private readonly AI_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_AI_CACHE_SIZE = 500;

  constructor(private prisma: PrismaService) {
    console.log('CustomDictionaryService initialized (Centralized Mode)');
  }

  private normalizeLookupInput(input: string): string {
    if (!input) return '';
    return input
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private stripEdgePunctuation(input: string): string {
    if (!input) return '';
    const edgePunctuation =
      /^[\s\u3000.,!?;:'"`~@#$%^&*()_+\-=\[\]{}<>/\\|，。！？；：、（）【】《》〈〉「」『』“”‘’·…—]+|[\s\u3000.,!?;:'"`~@#$%^&*()_+\-=\[\]{}<>/\\|，。！？；：、（）【】《》〈〉「」『』“”‘’·…—]+$/g;
    return input.replace(edgePunctuation, '').trim();
  }

  private buildLookupCandidates(rawInput: string): string[] {
    const normalized = this.normalizeLookupInput(rawInput);
    if (!normalized) return [];

    const stripped = this.stripEdgePunctuation(normalized);
    const candidates = new Set<string>([normalized]);

    if (stripped) {
      candidates.add(stripped);
    }

    return Array.from(candidates).filter(Boolean);
  }

  private applyContextPinyinScore(
    vocabPinyin: string | null | undefined,
    contextPinyin?: string,
  ): number {
    if (!contextPinyin || !vocabPinyin) return 0;

    const normalizePinyin = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    const target = normalizePinyin(contextPinyin);
    const source = normalizePinyin(vocabPinyin);
    if (!target || !source) return 0;
    if (target === source) return 40;
    if (source.includes(target) || target.includes(source)) return 20;
    return 0;
  }

  private scoreVocabularyMatch(
    vocab: any,
    candidates: string[],
    contextPinyin?: string,
  ): number {
    const hanzi = String(vocab?.hanzi || '');
    if (!hanzi) return Number.NEGATIVE_INFINITY;

    let best = 0;
    for (const candidate of candidates) {
      if (!candidate) continue;

      if (hanzi === candidate) {
        best = Math.max(
          best,
          1000 + this.applyContextPinyinScore(vocab?.pinyin, contextPinyin),
        );
        continue;
      }

      if (candidate.includes(hanzi)) {
        // Candidate is longer phrase, DB word is a meaningful sub-part
        best = Math.max(
          best,
          700 +
            hanzi.length * 5 +
            this.applyContextPinyinScore(vocab?.pinyin, contextPinyin),
        );
        continue;
      }

      if (hanzi.includes(candidate)) {
        // DB word is longer phrase, still useful fallback
        best = Math.max(
          best,
          500 +
            candidate.length * 3 +
            this.applyContextPinyinScore(vocab?.pinyin, contextPinyin),
        );
      }
    }

    return best;
  }

  private async findFlexibleVocabularyMatches(
    rawInput: string,
    contextPinyin?: string,
  ): Promise<any[]> {
    const candidates = this.buildLookupCandidates(rawInput);
    if (candidates.length === 0) return [];

    // 1) Exact match on normalized variants (fast path)
    const exactMatches = await this.prisma.vocabulary.findMany({
      where: {
        hanzi: { in: candidates },
      },
    });
    if (exactMatches.length > 0) {
      return exactMatches.sort(
        (a, b) =>
          this.scoreVocabularyMatch(b, candidates, contextPinyin) -
          this.scoreVocabularyMatch(a, candidates, contextPinyin),
      );
    }

    // 2) Phrase decomposition fallback (candidate contains a known word)
    const containsQueries = candidates.flatMap(
      (candidate) =>
        [
          { hanzi: { contains: candidate } },
          candidate.length > 1
            ? {
                AND: [
                  { hanzi: { not: candidate } },
                  { hanzi: { in: Array.from(candidate) } },
                ],
              }
            : null,
        ].filter(Boolean) as any[],
    );

    if (containsQueries.length === 0) return [];

    const fuzzyMatches = await this.prisma.vocabulary.findMany({
      where: {
        OR: containsQueries,
      },
      take: 40,
    });

    if (fuzzyMatches.length === 0) return [];

    return fuzzyMatches
      .sort(
        (a, b) =>
          this.scoreVocabularyMatch(b, candidates, contextPinyin) -
          this.scoreVocabularyMatch(a, candidates, contextPinyin),
      )
      .filter(
        (item, index, arr) => arr.findIndex((v) => v.id === item.id) === index,
      )
      .slice(0, 10);
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
      examples: this.splitCompoundExamples((vocab.examples as any[]) || []),
      synonyms: (vocab.synonyms as any[]) || [],
      antonyms: (vocab.antonyms as any[]) || [],
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
      const normalizedInput = this.normalizeLookupInput(hanzi);
      if (!normalizedInput) {
        return this.createNotFoundResult(hanzi);
      }

      // === STEP 1: Try to find in database ===

      // Level 1-2: Exact + flexible phrase/character fallback
      const dbMatches = await this.findFlexibleVocabularyMatches(
        normalizedInput,
        contextPinyin,
      );

      if (dbMatches.length > 0) {
        const entries = dbMatches.map((v) => this.transformToEntry(v));
        const first = entries[0];
        return {
          ...first,
          // Keep the original clicked token for display context,
          // but return the matched DB definition.
          hanzi: first.hanzi,
          allEntries: entries,
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
          const entries = fuzzyResults.map((v) => this.transformToEntry(v));
          const first = entries[0];
          return {
            ...first,
            hanzi: first.hanzi,
            allEntries: entries,
          };
        }
      }

      // === STEP 2: Not found in DB ===
      console.log(`[Dictionary] "${normalizedInput}" not found in DB`);
      return this.createNotFoundResult(normalizedInput);
    } catch (error) {
      console.error('CustomDictionary lookup error:', error);
      return this.createNotFoundResult(
        this.normalizeLookupInput(hanzi) || hanzi,
      );
    }
  }

  /**
   * Generate definition using Gemini AI
   * Disabled: dictionary now runs in DB-only mode.
   */
  private async generateWithAI(hanzi: string): Promise<LookupResult> {
    return this.createNotFoundResult(hanzi);
  }

  /**
   * Call Gemini API with retry logic
   */
  private async callGeminiWithRetry(
    apiKey: string,
    prompt: string,
    retryCount = 0,
  ): Promise<Response> {
    void apiKey;
    void prompt;
    void retryCount;
    return new Response(null, { status: 501 });
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
      const keysToDelete = Array.from(this.aiCache.keys()).slice(
        0,
        Math.floor(this.MAX_AI_CACHE_SIZE * 0.1),
      );
      keysToDelete.forEach((k) => this.aiCache.delete(k));
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

      return results.map((v) => ({
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
  async getExamples(
    hanzi: string,
  ): Promise<{ chinese: string; pinyin?: string; vietnamese: string }[]> {
    try {
      const normalizedInput = this.normalizeLookupInput(hanzi);
      if (!normalizedInput) return [];

      const matches = await this.findFlexibleVocabularyMatches(normalizedInput);
      const bestMatch = matches[0];
      if (!bestMatch) return [];

      const vocab = await this.prisma.vocabulary.findUnique({
        where: { id: bestMatch.id },
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
      const normalizedInput = this.normalizeLookupInput(hanzi);
      if (!normalizedInput) {
        return { hanzi, isSystemWord: false };
      }

      const matches = await this.findFlexibleVocabularyMatches(normalizedInput);
      const bestMatch = matches[0];
      if (!bestMatch) {
        return { hanzi: normalizedInput, isSystemWord: false };
      }

      const vocab = await this.prisma.vocabulary.findUnique({
        where: { id: bestMatch.id },
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
        return { hanzi: normalizedInput, isSystemWord: false };
      }

      return {
        hanzi: vocab.hanzi,
        radical: vocab.radical || undefined,
        radicalMeaning: vocab.radicalMeaning || undefined,
        strokeCount: vocab.strokeCount || undefined,
        synonyms: (vocab.synonyms as any[]) || [],
        antonyms: (vocab.antonyms as any[]) || [],
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
      if (
        cParts.length > 1 &&
        cParts.length === pParts.length &&
        cParts.length === vParts.length
      ) {
        for (let i = 0; i < cParts.length; i++) {
          result.push({
            chinese: cParts[i],
            pinyin: pParts[i],
            vietnamese: vParts[i],
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
  async getStatus(): Promise<{
    loaded: boolean;
    totalWords: number;
    aiCacheSize: number;
  }> {
    const count = await this.prisma.vocabulary.count();
    return {
      loaded: true,
      totalWords: count,
      aiCacheSize: this.aiCache.size,
    };
  }
}
