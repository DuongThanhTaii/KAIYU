import api from './api';

// Types
export interface VideoProgress {
    id: string;
    userId: string;
    videoId: string;
    progressPercent: number;
    lastPositionSeconds: number;
    lastWatchedAt?: string;
    completedAt?: string | null;
    updatedAt?: string;
    video: {
        id: string;
        title: string;
        thumbnailUrl?: string;
        durationSeconds: number;
        hskLevel: number;
        category?: string;
    };
}

export interface DailyProgress {
    date: string;
    dayName: string;
    vocabularySaved: number;
    reviewsCompleted: number;
    videosWatched: number;
    watchTimeMinutes: number;
}

export interface WeeklyProgress {
    days: DailyProgress[];
    totals: {
        totalVocab: number;
        totalReviews: number;
    };
}

export interface OverallStats {
    totalMinutesStudied: number;
    totalWordsLearned: number;
    totalVideosWatched: number;
    totalXpEarned: number;
    currentStreak: number;
    longestStreak: number;
    averageDaily: number;
    hskProgress: {
        level: number;
        wordsLearned: number;
        wordsTotal: number;
        percent: number;
    }[];
}

// Progress API
export const progressApi = {
    /**
     * Get video progress for user
     */
    async getVideoProgress(): Promise<VideoProgress[]> {
        const response = await api.get<VideoProgress[]>('/progress/videos');
        return response.data;
    },

    /**
     * Update progress for a specific video
     */
    async updateVideoProgress(
        videoId: string,
        data: { progressPercent: number; lastPositionSeconds: number }
    ): Promise<VideoProgress> {
        const response = await api.put<VideoProgress>(`/progress/videos/${videoId}`, data);
        return response.data;
    },

    /**
     * Get continue watching video (most recent incomplete video)
     */
    async getContinueWatching(): Promise<VideoProgress | null> {
        try {
            const progress = await this.getVideoProgress();
            // Find first video with progress < 95% (not completed)
            const continueVideo = progress.find(p => p.progressPercent < 95);
            return continueVideo || null;
        } catch {
            return null;
        }
    },

    /**
     * Get daily progress
     */
    async getDailyProgress(): Promise<DailyProgress> {
        const response = await api.get<DailyProgress>('/progress/daily');
        return response.data;
    },

    /**
     * Get weekly progress
     */
    async getWeeklyProgress(): Promise<WeeklyProgress> {
        const response = await api.get<WeeklyProgress>('/progress/weekly');
        return response.data;
    },

    /**
     * Get overall statistics
     */
    async getOverallStats(): Promise<OverallStats> {
        const response = await api.get<OverallStats>('/progress/stats');
        return response.data;
    },

    /**
     * Calculate remaining time in minutes
     */
    calculateRemainingMinutes(progress: VideoProgress): number {
        const totalSeconds = progress.video.durationSeconds;
        const watchedSeconds = (progress.progressPercent / 100) * totalSeconds;
        const remainingSeconds = totalSeconds - watchedSeconds;
        return Math.ceil(remainingSeconds / 60);
    },

    /**
     * Format remaining time
     */
    formatRemainingTime(progress: VideoProgress): string {
        const minutes = this.calculateRemainingMinutes(progress);
        if (minutes <= 1) return '< 1 phút còn lại';
        return `${minutes} phút còn lại`;
    },

    /**
     * Format minutes to readable time
     */
    formatMinutes(minutes: number): string {
        if (minutes < 60) return `${minutes} phút`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    },
};

export default progressApi;
