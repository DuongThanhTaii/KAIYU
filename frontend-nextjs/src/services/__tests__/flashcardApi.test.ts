import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flashcardApi } from '../flashcardApi';
import api from '../api';

// Mock axios api
vi.mock('../api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
    },
}));

describe('Flashcard API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getQueue', () => {
        it('should fetch flashcard review queue', async () => {
            const mockQueue = {
                cards: [
                    { id: '1', vocabularyId: 'v1', status: 'new' },
                    { id: '2', vocabularyId: 'v2', status: 'learning' },
                ],
                total: 2,
                newCount: 1,
                reviewCount: 1,
            };
            (api.get as any).mockResolvedValue({ data: mockQueue });

            const result = await flashcardApi.getQueue();

            expect(api.get).toHaveBeenCalledWith('/flashcards/queue');
            expect(result).toEqual(mockQueue);
        });
    });

    describe('submitReview', () => {
        it('should submit flashcard review with cardId and rating', async () => {
            const cardId = 'card-123';
            const rating = 'good';
            const mockResponse = {
                success: true,
                nextReviewAt: '2024-01-20',
                newInterval: 7,
                newStatus: 'review',
            };
            (api.post as any).mockResolvedValue({ data: mockResponse });

            const result = await flashcardApi.submitReview(cardId, rating);

            expect(api.post).toHaveBeenCalledWith(`/flashcards/${cardId}/review`, { rating });
            expect(result).toEqual(mockResponse);
        });
    });

    describe('getStats', () => {
        it('should fetch flashcard statistics', async () => {
            const mockStats = {
                total: 100,
                new: 10,
                learning: 30,
                review: 45,
                graduated: 15,
                dueToday: 25,
            };
            (api.get as any).mockResolvedValue({ data: mockStats });

            const result = await flashcardApi.getStats();

            expect(api.get).toHaveBeenCalledWith('/flashcards/stats');
            expect(result).toEqual(mockStats);
        });
    });

    describe('getRatingLabel', () => {
        it('should return Vietnamese labels for ratings', () => {
            expect(flashcardApi.getRatingLabel('again')).toBe('Lại');
            expect(flashcardApi.getRatingLabel('hard')).toBe('Khó');
            expect(flashcardApi.getRatingLabel('good')).toBe('Tốt');
            expect(flashcardApi.getRatingLabel('easy')).toBe('Dễ');
        });
    });

    describe('formatInterval', () => {
        it('should format intervals correctly', () => {
            expect(flashcardApi.formatInterval(0)).toBe('< 10 phút');
            expect(flashcardApi.formatInterval(1)).toBe('1 ngày');
            expect(flashcardApi.formatInterval(5)).toBe('5 ngày');
            expect(flashcardApi.formatInterval(14)).toBe('2 tuần');
            expect(flashcardApi.formatInterval(60)).toBe('2 tháng');
            expect(flashcardApi.formatInterval(400)).toBe('1 năm');
        });
    });
});
