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
    hskLevel?: number;
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
    note?: string;
}

export interface SavedWordStatus {
    hanzi: string;
    vocabularyId: string | null;
    saved: boolean;
    userVocabularyId: string | null;
    folderId: string | null;
    savedAt: string | null;
}

export interface SavedWordBatchStatus {
    savedHanzi: string[];
    items: SavedWordStatus[];
}

const SAVED_WORD_CACHE_TTL_MS = 5 * 60 * 1000;
const SAVED_WORD_BATCH_SIZE = 200;

type SavedWordCacheEntry = {
    value: SavedWordStatus;
    expiresAt: number;
};

const savedWordCache = new Map<string, SavedWordCacheEntry>();

const normalizeHanzi = (hanzi: string): string =>
    String(hanzi || '').normalize('NFKC').trim();

const getSavedWordCache = (hanzi: string): SavedWordStatus | null => {
    const key = normalizeHanzi(hanzi);
    if (!key) return null;

    const cached = savedWordCache.get(key);
    if (!cached) return null;

    if (cached.expiresAt < Date.now()) {
        savedWordCache.delete(key);
        return null;
    }

    return cached.value;
};

const setSavedWordCache = (status: SavedWordStatus) => {
    const key = normalizeHanzi(status.hanzi);
    if (!key) return;

    savedWordCache.set(key, {
        value: { ...status, hanzi: key },
        expiresAt: Date.now() + SAVED_WORD_CACHE_TTL_MS,
    });
};

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
        if (query?.hskLevel) params.append('hskLevel', query.hskLevel.toString());

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

    /**
     * Check if a specific word was already saved by current user
     */
    async checkSavedWord(
        hanzi: string,
        options?: { knownSavedWords?: Iterable<string> }
    ): Promise<SavedWordStatus> {
        const normalized = normalizeHanzi(hanzi);
        if (!normalized) {
            return {
                hanzi: '',
                vocabularyId: null,
                saved: false,
                userVocabularyId: null,
                folderId: null,
                savedAt: null,
            };
        }

        if (options?.knownSavedWords) {
            for (const knownWord of options.knownSavedWords) {
                if (normalizeHanzi(knownWord) === normalized) {
                    const knownSavedStatus: SavedWordStatus = {
                        hanzi: normalized,
                        vocabularyId: null,
                        saved: true,
                        userVocabularyId: null,
                        folderId: null,
                        savedAt: null,
                    };
                    setSavedWordCache(knownSavedStatus);
                    return knownSavedStatus;
                }
            }
        }

        const cached = getSavedWordCache(normalized);
        if (cached) {
            return cached;
        }

        const response = await api.get<SavedWordStatus>(`/user-vocabulary/check?hanzi=${encodeURIComponent(normalized)}`);
        const status = {
            ...response.data,
            hanzi: normalizeHanzi(response.data.hanzi || normalized),
        };
        setSavedWordCache(status);
        return status;
    },

    /**
     * Batch check saved state for a list of words (used for subtitle preload)
     */
    async checkSavedWordsBatch(hanziList: string[]): Promise<SavedWordBatchStatus> {
        const normalizedList = Array.from(
            new Set((hanziList || []).map((word) => normalizeHanzi(word)).filter(Boolean))
        );

        if (normalizedList.length === 0) {
            return { savedHanzi: [], items: [] };
        }

        const uncachedWords: string[] = [];
        const cachedItems: SavedWordStatus[] = [];

        for (const word of normalizedList) {
            const cached = getSavedWordCache(word);
            if (cached) {
                cachedItems.push(cached);
            } else {
                uncachedWords.push(word);
            }
        }

        const apiItems: SavedWordStatus[] = [];
        if (uncachedWords.length > 0) {
            for (let i = 0; i < uncachedWords.length; i += SAVED_WORD_BATCH_SIZE) {
                const chunk = uncachedWords.slice(i, i + SAVED_WORD_BATCH_SIZE);
                const response = await api.post<SavedWordBatchStatus>('/user-vocabulary/check-batch', {
                    hanziList: chunk,
                });
                const normalizedItems = response.data.items.map((item) => ({
                    ...item,
                    hanzi: normalizeHanzi(item.hanzi),
                }));
                normalizedItems.forEach(setSavedWordCache);
                apiItems.push(...normalizedItems);
            }
        }

        const allItems = [...cachedItems, ...apiItems];
        const savedHanzi = allItems.filter((item) => item.saved).map((item) => item.hanzi);

        return {
            savedHanzi,
            items: allItems,
        };
    },

    /**
     * Prime cache after save/remove operations to keep icon state instantly accurate
     */
    primeSavedWordCache(status: SavedWordStatus) {
        setSavedWordCache(status);
    },
};

export default userVocabularyApi;
