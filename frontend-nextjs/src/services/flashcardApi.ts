import api from './api';

// Types
export type SRSRating = 'again' | 'hard' | 'good' | 'easy';

export interface FlashcardReview {
    id: string;
    userId?: string;
    vocabularyId: string;
    status: 'new' | 'learning' | 'review' | 'graduated';
    interval?: number;
    intervalDays?: number;
    easeFactor?: number;
    nextReviewAt?: string;
    reviewCount: number;
    level?: number; // Level 1-5
    // Context fields for rich SRS flashcards
    sourceTimestamp?: number;
    sourceSentence?: string;
    sourcePinyin?: string;
    sourceImageUrl?: string;
    sourceAudioUrl?: string;
    sourceVideoUrl?: string; // For video clip playback
    sourceVideoId?: string; // Database ID for subtitles lookup
    sourceMeaning?: string;
    sourceTokens?: any[];
    // Backend returns 'word', frontend types as 'vocabulary'
    word?: {
        id: string;
        hanzi: string;
        pinyin: string;
        meaningEn: string;
        meaningVi?: string;
        hskLevel: number;
        audioUrl?: string;
        partOfSpeech?: string;
        examples?: Array<{
            hanzi: string;
            pinyin: string;
            meaning: string;
            meaningVi?: string;
        }>;
    };
    vocabulary?: {
        id: string;
        hanzi: string;
        pinyin: string;
        meaningEn: string;
        meaningVi?: string;
        hskLevel: number;
        audioUrl?: string;
        partOfSpeech?: string;
        examples?: Array<{
            hanzi: string;
            pinyin: string;
            meaning: string;
            meaningVi?: string;
        }>;
    };
}

export interface FlashcardQueue {
    cards: FlashcardReview[];
    total: number;
    newCount: number;
    reviewCount: number;
}

export interface FlashcardStats {
    total: number;
    new: number;
    learning: number;
    review: number;
    graduated: number;
    dueToday: number;
}

export interface ReviewResult {
    success: boolean;
    nextReviewAt: string;
    newInterval: number;
    newStatus: string;
    level?: number;
}

export interface LevelStats {
    total: number;
    levels: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
    };
    levelLabels: {
        1: string;
        2: string;
        3: string;
        4: string;
        5: string;
    };
}

// Flashcard API
export const flashcardApi = {
    /**
     * Get flashcard review queue
     */
    async getQueue(): Promise<FlashcardQueue> {
        const response = await api.get<FlashcardQueue>('/flashcards/queue');
        return response.data;
    },

    /**
     * Submit a review result
     */
    async submitReview(cardId: string, rating: SRSRating): Promise<ReviewResult> {
        const response = await api.post<ReviewResult>(`/flashcards/${cardId}/review`, { rating });
        return response.data;
    },

    /**
     * Get flashcard statistics
     */
    async getStats(): Promise<FlashcardStats> {
        const response = await api.get<FlashcardStats>('/flashcards/stats');
        return response.data;
    },

    /**
     * Get vocabulary by level (1-5)
     */
    async getByLevel(level?: number): Promise<FlashcardReview[]> {
        const params = level ? `?level=${level}` : '';
        const response = await api.get<FlashcardReview[]>(`/flashcards/by-level${params}`);
        return response.data;
    },

    /**
     * Get statistics by level (1-5)
     */
    async getStatsByLevel(): Promise<LevelStats> {
        const response = await api.get<LevelStats>('/flashcards/stats/by-level');
        return response.data;
    },

    /**
     * Get rating description in Vietnamese
     */
    getRatingLabel(rating: SRSRating): string {
        switch (rating) {
            case 'again': return 'Lại';
            case 'hard': return 'Khó';
            case 'good': return 'Tốt';
            case 'easy': return 'Dễ';
        }
    },

    /**
     * Get rating color
     */
    getRatingColor(rating: SRSRating): string {
        switch (rating) {
            case 'again': return 'bg-red-500 hover:bg-red-400';
            case 'hard': return 'bg-orange-500 hover:bg-orange-400';
            case 'good': return 'bg-primary hover:bg-primary-hover';
            case 'easy': return 'bg-blue-500 hover:bg-blue-400';
        }
    },

    /**
     * Get recently added vocabulary for quick review
     */
    async getRecentlyAdded(options?: { videoId?: string; limit?: number }): Promise<FlashcardReview[]> {
        const params = new URLSearchParams();
        if (options?.videoId) params.append('videoId', options.videoId);
        if (options?.limit) params.append('limit', options.limit.toString());
        const queryString = params.toString() ? `?${params.toString()}` : '';
        const response = await api.get<FlashcardReview[]>(`/flashcards/recently-added${queryString}`);
        return response.data;
    },

    /**
     * Get level label in Vietnamese
     */
    getLevelLabel(level: number): string {
        switch (level) {
            case 1: return 'Mới học';
            case 2: return 'Đang học';
            case 3: return 'Quen';
            case 4: return 'Thuộc';
            case 5: return 'Thành thạo';
            default: return 'Không xác định';
        }
    },

    /**
     * Get level color
     */
    getLevelColor(level: number): string {
        switch (level) {
            case 1: return 'bg-red-500/20 text-red-400';
            case 2: return 'bg-orange-500/20 text-orange-400';
            case 3: return 'bg-yellow-500/20 text-yellow-400';
            case 4: return 'bg-blue-500/20 text-blue-400';
            case 5: return 'bg-green-500/20 text-green-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    },

    /**
     * Format interval to human readable
     */
    formatInterval(days: number): string {
        if (days === 0) return '< 10 phút';
        if (days === 1) return '1 ngày';
        if (days < 7) return `${days} ngày`;
        if (days < 30) return `${Math.floor(days / 7)} tuần`;
        if (days < 365) return `${Math.floor(days / 30)} tháng`;
        return `${Math.floor(days / 365)} năm`;
    },
};

export default flashcardApi;

