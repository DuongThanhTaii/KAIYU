import api from './api';

export interface DictionaryEntry {
    id?: string;
    pinyin: string;
    pinyinDisplay: string;
    definitions?: string[];
    definitionsVi?: string[];
    meaningEn?: string;
    meaningVi: string;
    partOfSpeech?: string;
    radical?: string;
    radicalMeaning?: string;
    strokeCount?: number;
    hskLevel?: number;
    examples?: { chinese: string; pinyin?: string; vietnamese: string }[];
    synonyms?: { hanzi: string; pinyin: string; meaningVi: string }[];
    antonyms?: { hanzi: string; pinyin: string; meaningVi: string }[];
    mnemonic?: string;
    found: boolean;
    // Centralized system flags
    source: 'db' | 'ai';
    isSystemWord: boolean;
}

export interface LookupResult {
    hanzi: string;
    pinyin: string;
    pinyinDisplay: string;
    definitions?: string[];
    definitionsVi?: string[];
    meaningEn?: string;
    meaningVi: string;
    partOfSpeech?: string;
    radical?: string;
    radicalMeaning?: string;
    strokeCount?: number;
    hskLevel?: number;
    examples?: { chinese: string; pinyin?: string; vietnamese: string }[];
    synonyms?: { hanzi: string; pinyin: string; meaningVi: string }[];
    antonyms?: { hanzi: string; pinyin: string; meaningVi: string }[];
    mnemonic?: string;
    traditional?: string;
    simplified?: string;
    found: boolean;
    // Centralized system flags
    source: 'db' | 'ai';
    isSystemWord: boolean;
    // All entries with different pronunciations
    allEntries?: DictionaryEntry[];
}

export interface DictionaryStatus {
    loaded: boolean;
    totalWords?: number;
    aiCacheSize?: number;
}

export interface ExampleSentence {
    chinese: string;
    pinyin?: string;
    translation: string;
}

// Enriched word data types
export interface StrokeData {
    character: string;
    strokes: string[];
    medians: number[][][];
}

export interface Decomposition {
    radical: { char: string; meaning: string; pinyin?: string };
    components: { char: string; meaning: string; pinyin?: string }[];
}

export interface Mnemonic {
    visualStory: string;
    soundAssociation?: string;
    characterBreakdown?: string;
}

export interface RelatedWord {
    hanzi: string;
    pinyin: string;
    meaning: string;
}

export interface RelatedWords {
    synonyms: RelatedWord[];
    antonyms: RelatedWord[];
    collocations: RelatedWord[];
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

export const dictionaryApi = {
    /**
     * Lookup a Chinese word/character in dictionary (with cache)
     * @param hanzi The Chinese character/word to lookup
     * @param contextPinyin Optional pinyin from video context to prioritize matching entries
     */
    async lookup(hanzi: string, contextPinyin?: string): Promise<LookupResult> {
        // Dynamic import to avoid SSR issues
        const { dictionaryCache } = await import('./dictionaryCache');

        // Check cache first
        const cached = dictionaryCache.getLookup(hanzi);
        if (cached) {
            console.log('[DictAPI] Cache hit for:', hanzi);
            return cached;
        }

        // Fetch from API
        console.log('[DictAPI] Cache miss, fetching:', hanzi);
        const params = contextPinyin ? `?context=${encodeURIComponent(contextPinyin)}` : '';
        const response = await api.get<LookupResult>(`/dictionary/lookup/${encodeURIComponent(hanzi)}${params}`);

        // Store in cache
        dictionaryCache.setLookup(hanzi, response.data);
        return response.data;
    },

    /**
     * Search for words by pinyin or Chinese
     */
    async search(query: string, limit = 20): Promise<LookupResult[]> {
        const response = await api.get<LookupResult[]>(`/dictionary/search?q=${encodeURIComponent(query)}&limit=${limit}`);
        return response.data;
    },

    /**
     * Get example sentences for a word
     */
    async getExamples(hanzi: string): Promise<ExampleSentence[]> {
        const response = await api.get<ExampleSentence[]>(`/dictionary/examples/${encodeURIComponent(hanzi)}`);
        return response.data;
    },

    /**
     * Get enriched data for a word (with cache)
     */
    async getEnrichedData(hanzi: string, pinyin?: string, meaning?: string): Promise<EnrichedWordData> {
        // Dynamic import to avoid SSR issues
        const { dictionaryCache } = await import('./dictionaryCache');

        // Check cache first
        const cached = dictionaryCache.getEnriched(hanzi);
        if (cached) {
            console.log('[DictAPI] Enriched cache hit for:', hanzi);
            return cached;
        }

        // Fetch from API
        console.log('[DictAPI] Enriched cache miss, fetching:', hanzi);
        const params = new URLSearchParams();
        if (pinyin) params.append('pinyin', pinyin);
        if (meaning) params.append('meaning', meaning);
        const queryString = params.toString();
        const url = `/dictionary/enrich/${encodeURIComponent(hanzi)}${queryString ? `?${queryString}` : ''}`;
        const response = await api.get<EnrichedWordData>(url);

        // Store in cache
        dictionaryCache.setEnriched(hanzi, response.data);
        return response.data;
    },

    /**
     * Check dictionary status
     */
    async getStatus(): Promise<DictionaryStatus> {
        const response = await api.get<DictionaryStatus>('/dictionary/status');
        return response.data;
    },

    /**
     * Get lookup history
     */
    async getHistory() {
        const { dictionaryCache } = await import('./dictionaryCache');
        return dictionaryCache.getHistory();
    },

    /**
     * Clear all cache
     */
    async clearCache() {
        const { dictionaryCache } = await import('./dictionaryCache');
        dictionaryCache.clearAll();
    },
};

export default dictionaryApi;
