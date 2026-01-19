import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userVocabularyApi } from '../userVocabularyApi';
import api from '../api';

// Mock axios api
vi.mock('../api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

describe('User Vocabulary API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAll', () => {
        it('should fetch all user vocabulary with query params', async () => {
            const mockResponse = {
                data: [
                    { id: '1', vocabularyId: 'v1', proficiency: 'learning' },
                    { id: '2', vocabularyId: 'v2', proficiency: 'mastered' },
                ],
                meta: { total: 2, page: 1, limit: 20 },
            };
            (api.get as any).mockResolvedValue({ data: mockResponse });

            const result = await userVocabularyApi.getAll();

            // getAll builds URLSearchParams even when empty
            expect(api.get).toHaveBeenCalled();
            const calledUrl = (api.get as any).mock.calls[0][0];
            expect(calledUrl).toContain('/user-vocabulary');
            expect(result).toEqual(mockResponse);
        });
    });

    describe('save', () => {
        it('should save vocabulary to user collection', async () => {
            const saveData = { vocabularyId: 'vocab-123', sourceVideoId: 'video-456' };
            const mockResponse = { id: '1', ...saveData, proficiency: 'new' };
            (api.post as any).mockResolvedValue({ data: mockResponse });

            const result = await userVocabularyApi.save(saveData);

            expect(api.post).toHaveBeenCalledWith('/user-vocabulary', saveData);
            expect(result).toEqual(mockResponse);
        });
    });

    describe('remove', () => {
        it('should remove vocabulary from user collection', async () => {
            const mockResponse = { message: 'Removed successfully' };
            (api.delete as any).mockResolvedValue({ data: mockResponse });

            const result = await userVocabularyApi.remove('vocab-123');

            expect(api.delete).toHaveBeenCalledWith('/user-vocabulary/vocab-123');
            expect(result).toEqual(mockResponse);
        });
    });

    describe('getStats', () => {
        it('should fetch vocabulary statistics', async () => {
            const mockStats = {
                total: 100,
                mastered: 50,
                learning: 30,
                new: 20,
                review: 0,
                savedThisWeek: 10,
            };
            (api.get as any).mockResolvedValue({ data: mockStats });

            const result = await userVocabularyApi.getStats();

            expect(api.get).toHaveBeenCalledWith('/user-vocabulary/stats');
            expect(result).toEqual(mockStats);
        });
    });

    describe('updateProficiency', () => {
        it('should update proficiency for a vocabulary', async () => {
            const mockResponse = { id: '1', proficiency: 'mastered', proficiencyPercent: 100 };
            (api.put as any).mockResolvedValue({ data: mockResponse });

            const result = await userVocabularyApi.updateProficiency('vocab-123', {
                proficiency: 'mastered',
                proficiencyPercent: 100,
            });

            expect(api.put).toHaveBeenCalledWith('/user-vocabulary/vocab-123/proficiency', {
                proficiency: 'mastered',
                proficiencyPercent: 100,
            });
            expect(result).toEqual(mockResponse);
        });
    });
});
