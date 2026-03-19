import api from './api';
import type { Vocabulary } from './vocabularyApi';

// Types
export interface UserVocabulary {
    id: string;
    userId: string;
    vocabularyId: string;
    sourceVideoId?: string;
    proficiency: 'new' | 'learning' | 'review' | 'mastered';
    proficiencyPercent: number;
    savedAt: string;
    lastReviewedAt?: string;
    vocabulary: Vocabulary;
    sourceVideo?: {
        id: string;
        title: string;
        thumbnailUrl?: string;
    };
    // Context fields for SRS flashcard
    sourceTimestamp?: number;
    sourceSentence?: string;
    sourcePinyin?: string;
    // Media fields for rich flashcards
    sourceImageUrl?: string;
    sourceAudioUrl?: string;
    sourceMeaning?: string;
    sourceTokens?: any[];
}

export interface UserVocabularyListResponse {
    data: UserVocabulary[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface UserVocabularyQuery {
    page?: number;
    limit?: number;
    proficiency?: string;
    search?: string;
    sourceVideoId?: string;
}

export interface UserVocabularyStats {
    total: number;
    new: number;
    learning: number;
    review: number;
    mastered: number;
    savedThisWeek: number;
}

export interface SaveVocabularyData {
    vocabularyId: string;
    sourceVideoId?: string;
    folderId?: string;
}

export interface SaveWordData {
    hanzi: string;
    pinyin?: string;
    meaningVi?: string;
    sourceVideoId?: string;
    folderId?: string;
    // Context fields for SRS enhancement
    sourceTimestamp?: number;
    sourceSentence?: string;
    sourcePinyin?: string;
    // Media fields for rich flashcards
    sourceImageUrl?: string;
    sourceAudioUrl?: string;
    sourceMeaning?: string;
    sourceTokens?: any[];
}

// User Vocabulary API (requires authentication)
export const userVocabularyApi = {
    /**
     * Get user's saved vocabulary with pagination and filters
     */
    async getAll(query?: UserVocabularyQuery): Promise<UserVocabularyListResponse> {
        const params = new URLSearchParams();
        if (query?.page) params.append('page', query.page.toString());
        if (query?.limit) params.append('limit', query.limit.toString());
        if (query?.proficiency) params.append('proficiency', query.proficiency);
        if (query?.search) params.append('search', query.search);
        if (query?.sourceVideoId) params.append('sourceVideoId', query.sourceVideoId);

        const response = await api.get<UserVocabularyListResponse>(`/user-vocabulary?${params.toString()}`);
        return response.data;
    },

    /**
     * Save vocabulary to user's notebook
     */
    async save(data: SaveVocabularyData): Promise<UserVocabulary> {
        const response = await api.post<UserVocabulary>('/user-vocabulary', data);
        return response.data;
    },

    /**
     * Save a word from dictionary lookup (creates vocabulary if needed)
     */
    async saveWord(data: SaveWordData): Promise<UserVocabulary> {
        const response = await api.post<UserVocabulary>('/user-vocabulary/word', data);
        return response.data;
    },

    /**
     * Update proficiency for a saved vocabulary
     */
    async updateProficiency(
        id: string,
        data: { proficiency: string; proficiencyPercent: number }
    ): Promise<UserVocabulary> {
        const response = await api.put<UserVocabulary>(`/user-vocabulary/${id}/proficiency`, data);
        return response.data;
    },

    /**
     * Remove vocabulary from user's notebook
     */
    async remove(id: string): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(`/user-vocabulary/${id}`);
        return response.data;
    },

    /**
     * Get user's vocabulary statistics
     */
    async getStats(): Promise<UserVocabularyStats> {
        const response = await api.get<UserVocabularyStats>('/user-vocabulary/stats');
        return response.data;
    },
};

export default userVocabularyApi;
