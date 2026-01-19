import { describe, it, expect, vi, beforeEach } from 'vitest';
import { progressApi } from '../progressApi';
import api from '../api';

// Mock axios api
vi.mock('../api', () => ({
    default: {
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn(),
    },
}));

describe('Progress API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getVideoProgress', () => {
        it('should fetch video progress list', async () => {
            const mockProgress = [
                { id: '1', videoId: 'v1', progressPercent: 50, lastPositionSeconds: 120 },
                { id: '2', videoId: 'v2', progressPercent: 100, lastPositionSeconds: 300 },
            ];
            (api.get as any).mockResolvedValue({ data: mockProgress });

            const result = await progressApi.getVideoProgress();

            expect(api.get).toHaveBeenCalledWith('/progress/videos');
            expect(result).toEqual(mockProgress);
        });
    });

    describe('updateVideoProgress', () => {
        it('should update progress for a specific video', async () => {
            const videoId = 'video-123';
            const updateData = { progressPercent: 75, lastPositionSeconds: 180 };
            const mockResponse = { id: '1', videoId, ...updateData };
            (api.put as any).mockResolvedValue({ data: mockResponse });

            const result = await progressApi.updateVideoProgress(videoId, updateData);

            expect(api.put).toHaveBeenCalledWith(`/progress/videos/${videoId}`, updateData);
            expect(result).toEqual(mockResponse);
        });
    });

    describe('getDailyProgress', () => {
        it('should fetch daily progress stats', async () => {
            const mockDaily = {
                date: '2024-01-15',
                minutesStudied: 45,
                wordsLearned: 10,
                videosWatched: 2,
            };
            (api.get as any).mockResolvedValue({ data: mockDaily });

            const result = await progressApi.getDailyProgress();

            expect(api.get).toHaveBeenCalledWith('/progress/daily');
            expect(result).toEqual(mockDaily);
        });
    });

    describe('getWeeklyProgress', () => {
        it('should fetch weekly progress stats', async () => {
            const mockWeekly = {
                week: 'Week 3',
                totalMinutes: 180,
                totalWords: 50,
                dailyData: [],
            };
            (api.get as any).mockResolvedValue({ data: mockWeekly });

            const result = await progressApi.getWeeklyProgress();

            expect(api.get).toHaveBeenCalledWith('/progress/weekly');
            expect(result).toEqual(mockWeekly);
        });
    });

    describe('getOverallStats', () => {
        it('should fetch overall statistics', async () => {
            const mockStats = {
                totalMinutesStudied: 1200,
                totalWordsLearned: 500,
                currentStreak: 12,
                longestStreak: 30,
            };
            (api.get as any).mockResolvedValue({ data: mockStats });

            const result = await progressApi.getOverallStats();

            expect(api.get).toHaveBeenCalledWith('/progress/stats');
            expect(result).toEqual(mockStats);
        });
    });

    describe('formatMinutes', () => {
        it('should format minutes less than 60', () => {
            expect(progressApi.formatMinutes(30)).toBe('30 phút');
            expect(progressApi.formatMinutes(45)).toBe('45 phút');
        });

        it('should format hours and minutes', () => {
            expect(progressApi.formatMinutes(90)).toBe('1h 30m');
            expect(progressApi.formatMinutes(150)).toBe('2h 30m');
        });

        it('should format exact hours without minutes', () => {
            expect(progressApi.formatMinutes(60)).toBe('1h');
            expect(progressApi.formatMinutes(120)).toBe('2h');
        });
    });
});
