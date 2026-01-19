import { describe, it, expect, vi, beforeEach } from 'vitest';
import { achievementsApi } from '../achievementsApi';
import api from '../api';

// Mock axios api
vi.mock('../api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

describe('Achievements API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getUserAchievements', () => {
        it('should fetch all achievements with user earned status', async () => {
            const mockAchievements = [
                { id: '1', title: 'First Steps', description: 'Complete first lesson', earnedAt: '2024-01-15' },
                { id: '2', title: 'Word Master', description: 'Learn 100 words', earnedAt: null },
            ];
            (api.get as any).mockResolvedValue({ data: mockAchievements });

            const result = await achievementsApi.getUserAchievements();

            expect(api.get).toHaveBeenCalledWith('/achievements');
            expect(result).toEqual(mockAchievements);
        });
    });

    describe('getEarnedAchievements', () => {
        it('should fetch only earned achievements', async () => {
            const mockEarned = [
                { id: '1', title: 'First Steps', xpReward: 50, earnedAt: '2024-01-15' },
            ];
            (api.get as any).mockResolvedValue({ data: mockEarned });

            const result = await achievementsApi.getEarnedAchievements();

            expect(api.get).toHaveBeenCalledWith('/achievements/earned');
            expect(result).toEqual(mockEarned);
        });
    });

    describe('getAllAchievements', () => {
        it('should fetch all available achievements', async () => {
            const mockAll = [
                { id: '1', title: 'First Steps', xpReward: 50 },
                { id: '2', title: 'Second Steps', xpReward: 100 },
            ];
            (api.get as any).mockResolvedValue({ data: mockAll });

            const result = await achievementsApi.getAllAchievements();

            expect(api.get).toHaveBeenCalledWith('/achievements/all');
            expect(result).toEqual(mockAll);
        });
    });

    describe('checkAchievements', () => {
        it('should check and award new achievements', async () => {
            const mockNewAchievements = [
                { id: '3', title: 'New Achievement', earnedAt: '2024-01-20' },
            ];
            (api.post as any).mockResolvedValue({ data: mockNewAchievements });

            const result = await achievementsApi.checkAchievements();

            expect(api.post).toHaveBeenCalledWith('/achievements/check');
            expect(result).toEqual(mockNewAchievements);
        });
    });
});
