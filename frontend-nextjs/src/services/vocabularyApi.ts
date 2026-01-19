import api from './api';

// Types
export interface Vocabulary {
    id: string;
    hanzi: string;
    pinyin: string;
    meaningEn: string;
    meaningVi?: string;
    partOfSpeech?: string;
    hskLevel: number;
    tags: string[];
    audioUrl?: string;
    examples?: ExampleSentence[];
    createdAt: string;
}

export interface ExampleSentence {
    hanzi: string;
    pinyin: string;
    meaningVi: string;
}

export interface VocabularyListResponse {
    data: Vocabulary[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface VocabularyQuery {
    page?: number;
    limit?: number;
    hskLevel?: number;
    search?: string;
    partOfSpeech?: string;
}

export interface HskLevelStat {
    hskLevel: number;
    count: number;
}

// Vocabulary API (public - for viewing vocabulary)
export const vocabularyApi = {
    /**
     * Get vocabulary list with pagination and filters
     */
    async getAll(query?: VocabularyQuery): Promise<VocabularyListResponse> {
        const params = new URLSearchParams();
        if (query?.page) params.append('page', query.page.toString());
        if (query?.limit) params.append('limit', query.limit.toString());
        if (query?.hskLevel) params.append('hskLevel', query.hskLevel.toString());
        if (query?.search) params.append('search', query.search);
        if (query?.partOfSpeech) params.append('partOfSpeech', query.partOfSpeech);

        const response = await api.get<VocabularyListResponse>(`/vocabulary?${params.toString()}`);
        return response.data;
    },

    /**
     * Get vocabulary by ID
     */
    async getById(id: string): Promise<Vocabulary> {
        const response = await api.get<Vocabulary>(`/vocabulary/${id}`);
        return response.data;
    },

    /**
     * Get vocabulary by hanzi
     */
    async getByHanzi(hanzi: string): Promise<Vocabulary> {
        const response = await api.get<Vocabulary>(`/vocabulary/hanzi/${encodeURIComponent(hanzi)}`);
        return response.data;
    },

    /**
     * Get example sentences for a vocabulary word
     * Returns from cache or generates with AI
     */
    async getExamples(vocabularyId: string): Promise<ExampleSentence[]> {
        const response = await api.get<ExampleSentence[]>(`/vocabulary/${vocabularyId}/examples`);
        return response.data;
    },

    /**
     * Get HSK level statistics
     */
    async getStats(): Promise<HskLevelStat[]> {
        const response = await api.get<HskLevelStat[]>('/vocabulary/stats');
        return response.data;
    },
};

export default vocabularyApi;

