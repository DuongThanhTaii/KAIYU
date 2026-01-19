'use client';

const STORAGE_KEY = 'watch_time_tracker';
const SYNC_INTERVAL_MS = 30000; // 30 seconds

interface WatchSession {
    videoId: string;
    startedAt: number;
    accumulatedSeconds: number;
    isPlaying: boolean;
}

interface StoredProgress {
    totalWatchTimeSeconds: number;
    todayWatchTimeSeconds: number;
    todayDate: string;
    lastVideoId?: string;
    lastVideoTitle?: string;
    vocabCount: number;
}

/**
 * Watch Time Tracker Service
 * Tracks real video play time and stores in localStorage
 * Syncs to backend periodically
 */
class WatchTimeTrackerService {
    private currentSession: WatchSession | null = null;
    private syncInterval: NodeJS.Timeout | null = null;
    private onSyncCallback: ((seconds: number, videoId: string) => Promise<void>) | null = null;

    /**
     * Get stored progress from localStorage
     */
    getStoredProgress(): StoredProgress {
        if (typeof window === 'undefined') {
            return this.getDefaultProgress();
        }

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return this.getDefaultProgress();

            const data = JSON.parse(stored) as StoredProgress;

            // Reset today's time if it's a new day
            const today = new Date().toISOString().split('T')[0];
            if (data.todayDate !== today) {
                data.todayWatchTimeSeconds = 0;
                data.todayDate = today;
                this.saveProgress(data);
            }

            return data;
        } catch {
            return this.getDefaultProgress();
        }
    }

    private getDefaultProgress(): StoredProgress {
        return {
            totalWatchTimeSeconds: 0,
            todayWatchTimeSeconds: 0,
            todayDate: new Date().toISOString().split('T')[0],
            vocabCount: 0,
        };
    }

    private saveProgress(progress: StoredProgress): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }

    /**
     * Start tracking when video plays
     */
    startTracking(videoId: string, videoTitle?: string): void {
        console.log('[WatchTime] Start tracking:', videoId);

        // Save last video info
        const progress = this.getStoredProgress();
        progress.lastVideoId = videoId;
        if (videoTitle) progress.lastVideoTitle = videoTitle;
        this.saveProgress(progress);

        this.currentSession = {
            videoId,
            startedAt: Date.now(),
            accumulatedSeconds: 0,
            isPlaying: true,
        };

        // Start sync interval
        if (!this.syncInterval) {
            this.syncInterval = setInterval(() => {
                this.syncToBackend();
            }, SYNC_INTERVAL_MS);
        }
    }

    /**
     * Pause tracking when video pauses
     */
    pauseTracking(): void {
        if (!this.currentSession || !this.currentSession.isPlaying) return;

        const elapsed = (Date.now() - this.currentSession.startedAt) / 1000;
        this.currentSession.accumulatedSeconds += elapsed;
        this.currentSession.isPlaying = false;

        console.log('[WatchTime] Paused, accumulated:', this.currentSession.accumulatedSeconds, 's');

        // Update localStorage immediately on pause
        this.updateLocalStorage();
    }

    /**
     * Resume tracking when video resumes
     */
    resumeTracking(): void {
        if (!this.currentSession) return;

        this.currentSession.startedAt = Date.now();
        this.currentSession.isPlaying = true;
        console.log('[WatchTime] Resumed');
    }

    /**
     * Stop tracking when leaving video
     */
    stopTracking(): void {
        if (!this.currentSession) return;

        // Accumulate final time if still playing
        if (this.currentSession.isPlaying) {
            const elapsed = (Date.now() - this.currentSession.startedAt) / 1000;
            this.currentSession.accumulatedSeconds += elapsed;
        }

        console.log('[WatchTime] Stop, total:', this.currentSession.accumulatedSeconds, 's');

        // Final update and sync
        this.updateLocalStorage();
        this.syncToBackend();

        // Clear interval
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        this.currentSession = null;
    }

    /**
     * Update localStorage with current session time
     */
    private updateLocalStorage(): void {
        if (!this.currentSession) return;

        const progress = this.getStoredProgress();
        const sessionSeconds = Math.round(this.currentSession.accumulatedSeconds);

        progress.totalWatchTimeSeconds += sessionSeconds;
        progress.todayWatchTimeSeconds += sessionSeconds;

        this.saveProgress(progress);

        // Reset accumulated after saving
        this.currentSession.accumulatedSeconds = 0;
    }

    /**
     * Sync to backend
     */
    private async syncToBackend(): Promise<void> {
        if (!this.currentSession) return;

        // Calculate current session time
        let seconds = this.currentSession.accumulatedSeconds;
        if (this.currentSession.isPlaying) {
            seconds += (Date.now() - this.currentSession.startedAt) / 1000;
        }

        if (seconds < 5) return; // Don't sync if less than 5 seconds

        console.log('[WatchTime] Syncing', Math.round(seconds), 's to backend');

        if (this.onSyncCallback) {
            try {
                await this.onSyncCallback(Math.round(seconds), this.currentSession.videoId);
            } catch (error) {
                console.error('[WatchTime] Sync failed:', error);
            }
        }
    }

    /**
     * Set callback for syncing to backend
     */
    setOnSync(callback: (seconds: number, videoId: string) => Promise<void>): void {
        this.onSyncCallback = callback;
    }

    /**
     * Increment vocabulary count
     */
    incrementVocabCount(): void {
        const progress = this.getStoredProgress();
        progress.vocabCount += 1;
        this.saveProgress(progress);
    }

    /**
     * Get today's watch time in minutes
     */
    getTodayMinutes(): number {
        const progress = this.getStoredProgress();
        let total = progress.todayWatchTimeSeconds;

        // Add current session if active
        if (this.currentSession) {
            total += this.currentSession.accumulatedSeconds;
            if (this.currentSession.isPlaying) {
                total += (Date.now() - this.currentSession.startedAt) / 1000;
            }
        }

        return Math.round(total / 60);
    }

    /**
     * Get total watch time in minutes
     */
    getTotalMinutes(): number {
        const progress = this.getStoredProgress();
        return Math.round(progress.totalWatchTimeSeconds / 60);
    }
}

// Singleton instance
export const watchTimeTracker = new WatchTimeTrackerService();
