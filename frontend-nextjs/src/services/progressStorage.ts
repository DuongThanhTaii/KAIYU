// LocalStorage service for storing user progress data
// This data persists even when user is logged out

const PROGRESS_KEY = 'KAIYU_recent_progress';

export interface RecentProgress {
    hskLevel: number;
    vocabPercent: number;
    streak: number;
    lastUpdated: string;
    userName?: string;
}

/**
 * Save progress to localStorage
 */
export const saveProgress = (progress: Partial<RecentProgress>) => {
    try {
        const existing = getProgress();
        const updated: RecentProgress = {
            hskLevel: progress.hskLevel ?? existing?.hskLevel ?? 1,
            vocabPercent: progress.vocabPercent ?? existing?.vocabPercent ?? 0,
            streak: progress.streak ?? existing?.streak ?? 0,
            lastUpdated: new Date().toISOString(),
            userName: progress.userName ?? existing?.userName,
        };
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(updated));
    } catch (err) {
        console.error('Failed to save progress to localStorage:', err);
    }
};

/**
 * Get progress from localStorage
 */
export const getProgress = (): RecentProgress | null => {
    try {
        const data = localStorage.getItem(PROGRESS_KEY);
        if (!data) return null;
        return JSON.parse(data) as RecentProgress;
    } catch (err) {
        console.error('Failed to get progress from localStorage:', err);
        return null;
    }
};

/**
 * Clear progress from localStorage
 */
export const clearProgress = () => {
    try {
        localStorage.removeItem(PROGRESS_KEY);
    } catch (err) {
        console.error('Failed to clear progress from localStorage:', err);
    }
};

export default {
    saveProgress,
    getProgress,
    clearProgress,
};
