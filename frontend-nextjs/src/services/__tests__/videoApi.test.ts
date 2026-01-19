import { describe, it, expect, vi, beforeEach } from 'vitest';
import { videoApi } from '../videoApi';
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

describe('Video API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAll', () => {
        it('should fetch videos with default query', async () => {
            const mockVideos = {
                data: [{ id: '1', title: 'Test Video' }],
                meta: { total: 1, page: 1, limit: 12 },
            };
            (api.get as any).mockResolvedValue({ data: mockVideos });

            const result = await videoApi.getAll();

            expect(api.get).toHaveBeenCalled();
            expect(result).toEqual(mockVideos);
        });

        it('should include query parameters in request', async () => {
            const mockVideos = { data: [], meta: { total: 0 } };
            (api.get as any).mockResolvedValue({ data: mockVideos });

            await videoApi.getAll({ hskLevel: 3, category: 'Daily Life' });

            const calledUrl = (api.get as any).mock.calls[0][0];
            // videoApi uses camelCase: hskLevel not hsk_level
            expect(calledUrl).toContain('hskLevel=3');
            expect(calledUrl).toContain('category=Daily');
        });
    });

    describe('getById', () => {
        it('should fetch a single video by ID', async () => {
            const mockVideo = { id: '123', title: 'Test Video', hskLevel: 2 };
            (api.get as any).mockResolvedValue({ data: mockVideo });

            const result = await videoApi.getById('123');

            expect(api.get).toHaveBeenCalledWith('/videos/123');
            expect(result).toEqual(mockVideo);
        });
    });

    describe('getSubtitles', () => {
        it('should fetch subtitles for a video', async () => {
            const mockSubtitles = [
                { id: '1', textChinese: '你好', startTime: 0, endTime: 3 },
                { id: '2', textChinese: '谢谢', startTime: 3, endTime: 6 },
            ];
            (api.get as any).mockResolvedValue({ data: mockSubtitles });

            const result = await videoApi.getSubtitles('video-123');

            expect(api.get).toHaveBeenCalledWith('/videos/video-123/subtitles');
            expect(result).toEqual(mockSubtitles);
        });
    });

    describe('formatDuration', () => {
        it('should format seconds to mm:ss', () => {
            expect(videoApi.formatDuration(0)).toBe('0:00');
            expect(videoApi.formatDuration(65)).toBe('1:05');
            expect(videoApi.formatDuration(3661)).toBe('61:01');
        });

        it('should handle edge cases', () => {
            expect(videoApi.formatDuration(59)).toBe('0:59');
            expect(videoApi.formatDuration(60)).toBe('1:00');
        });
    });

    describe('getYouTubeId', () => {
        it('should extract YouTube ID from various URL formats', () => {
            expect(videoApi.getYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
            expect(videoApi.getYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
        });

        it('should return null for non-YouTube URLs', () => {
            expect(videoApi.getYouTubeId('https://vimeo.com/123456')).toBeNull();
        });
    });

    describe('isYouTubeUrl', () => {
        it('should detect YouTube URLs', () => {
            expect(videoApi.isYouTubeUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
            expect(videoApi.isYouTubeUrl('https://youtu.be/abc')).toBe(true);
            expect(videoApi.isYouTubeUrl('https://vimeo.com/123')).toBe(false);
        });
    });
});
