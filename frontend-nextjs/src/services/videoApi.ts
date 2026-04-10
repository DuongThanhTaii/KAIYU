import api from './api';

// Types
export interface Video {
    id: string;
    title: string;
    description?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    durationSeconds: number;
    hskLevel: number;
    category: string;
    accent?: string;
    subtitleLanguages: string[];
    viewCount: number;
    isPublished: boolean;
    xpReward: number;
    createdAt: string;
    _count?: {
        subtitles: number;
    };
}

export interface VideoListResponse {
    data: Video[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface VideoQuery {
    page?: number;
    limit?: number;
    hskLevel?: number;
    category?: string;
    search?: string;
}

export interface Subtitle {
    id: string;
    videoId: string;
    startTime: number;
    endTime: number;
    hanzi: string;
    pinyin?: string;
    meaningVi?: string;
    meaningEn?: string;
    sequenceOrder: number;
    tokens?: SubtitleToken[];
}

export interface SubtitleToken {
    id: string;
    hanzi: string;
    pinyin?: string;
    meaning?: string;
    position: number;
    vocabularyId?: string;
    hskLevel?: number;
    partOfSpeech?: string;
}

export interface Category {
    category: string;
    count: number;
}

export type RecommendationLane = 'nextUp' | 'suited' | 'review';
export type RecommendationContext = 'learn' | 'dashboard';

export interface RecommendationItem {
    video: Video;
    lane: RecommendationLane;
    score: number;
    reasons: string[];
    estimatedComprehension: number;
    estimatedNewWords: number;
}

export interface RecommendationsResponse {
    generatedAt: string;
    context: RecommendationContext;
    nextUp: RecommendationItem | null;
    suited: RecommendationItem[];
    review: RecommendationItem[];
}

// Video API
export const videoApi = {
    /**
     * Get list of published videos with pagination and filters
     */
    async getAll(query?: VideoQuery): Promise<VideoListResponse> {
        const params = new URLSearchParams();
        if (query?.page) params.append('page', query.page.toString());
        if (query?.limit) params.append('limit', query.limit.toString());
        if (query?.hskLevel) params.append('hskLevel', query.hskLevel.toString());
        if (query?.category) params.append('category', query.category);
        if (query?.search) params.append('search', query.search);

        const response = await api.get<VideoListResponse>(`/videos?${params.toString()}`);
        return response.data;
    },

    /**
     * Get video details by ID
     */
    async getById(id: string): Promise<Video> {
        const response = await api.get<Video>(`/videos/${id}`);
        return response.data;
    },

    /**
     * Get subtitles for a video
     */
    async getSubtitles(videoId: string): Promise<Subtitle[]> {
        const response = await api.get<Subtitle[]>(`/videos/${videoId}/subtitles`);
        return response.data;
    },

    /**
     * Get vocabulary words from a video
     */
    async getVocabulary(videoId: string): Promise<any[]> {
        const response = await api.get<any[]>(`/videos/${videoId}/vocabulary`);
        return response.data;
    },

    /**
     * Get all categories with counts
     */
    async getCategories(): Promise<Category[]> {
        const response = await api.get<Category[]>('/videos/categories');
        return response.data;
    },

    /**
     * Get personalized recommendations for current user
     */
    async getRecommendations(
        context: RecommendationContext = 'learn',
        limit: number = 4,
        forceRefresh: boolean = false,
    ): Promise<RecommendationsResponse> {
        const params = new URLSearchParams();
        params.set('context', context);
        params.set('limit', String(limit));
        if (forceRefresh) params.set('forceRefresh', 'true');
        const response = await api.get<RecommendationsResponse>(
            `/videos/recommendations?${params.toString()}`
        );
        return response.data;
    },

    /**
     * Record a video view (requires 40s watch time)
     * Returns { counted: boolean, message: string }
     */
    async recordView(videoId: string, watchedSeconds: number): Promise<{ counted: boolean; message: string }> {
        const response = await api.post<{ counted: boolean; message: string }>(
            `/videos/${videoId}/view`,
            { watchedSeconds },
            { skipAuthRedirect: true }
        );
        return response.data;
    },

    /**
     * Format duration from seconds to mm:ss
     */
    formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * Get YouTube video ID from URL
     */
    getYouTubeId(url: string): string | null {
        const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    /**
     * Get YouTube thumbnail URL
     */
    getYouTubeThumbnail(videoUrl: string): string | null {
        const videoId = this.getYouTubeId(videoUrl);
        return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
    },

    /**
     * Check if URL is YouTube
     */
    isYouTubeUrl(url: string): boolean {
        return url.includes('youtube.com') || url.includes('youtu.be');
    },

    // Admin methods
    /**
     * Get all videos including unpublished (Admin)
     */
    async getAllAdmin(query?: VideoQuery): Promise<VideoListResponse> {
        const params = new URLSearchParams();
        if (query?.page) params.append('page', query.page.toString());
        if (query?.limit) params.append('limit', query.limit.toString());
        if (query?.hskLevel) params.append('hskLevel', query.hskLevel.toString());
        if (query?.category) params.append('category', query.category);
        if (query?.search) params.append('search', query.search);

        const response = await api.get<VideoListResponse>(`/admin/videos?${params.toString()}`);
        return response.data;
    },

    /**
     * Create a new video (Admin)
     */
    async create(data: CreateVideoDto): Promise<Video> {
        const response = await api.post<Video>('/admin/videos', data);
        return response.data;
    },

    /**
     * Update a video (Admin)
     */
    async update(id: string, data: Partial<CreateVideoDto>): Promise<Video> {
        const response = await api.put<Video>(`/admin/videos/${id}`, data);
        return response.data;
    },

    /**
     * Delete a video (Admin)
     */
    async remove(id: string): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(`/admin/videos/${id}`);
        return response.data;
    },

    /**
     * Publish a video (Admin)
     */
    async publish(id: string): Promise<Video> {
        const response = await api.post<Video>(`/admin/videos/${id}/publish`);
        return response.data;
    },

    /**
     * Get YouTube video info (duration, title, thumbnail)
     */
    async getYouTubeInfo(url: string): Promise<YouTubeVideoInfoResponse> {
        const response = await api.post<YouTubeVideoInfoResponse>('/videos/youtube/info', { url });
        return response.data;
    },

    /**
     * Upload subtitles for a video (Admin)
     */
    async uploadSubtitles(videoId: string, content: string, filename: string): Promise<{ message: string; count: number }> {
        const response = await api.post<{ message: string; count: number }>(`/videos/${videoId}/subtitles`, { content, filename });
        return response.data;
    },

    /**
     * Update a specific subtitle and its tokens (Admin)
     */
    async updateSubtitle(id: string, data: any): Promise<Subtitle> {
        const response = await api.put<Subtitle>(`/admin/subtitles/${id}`, data);
        return response.data;
    },

    // Saved Videos Methods
    /**
     * Get list of saved video IDs for current user
     */
    async getSavedVideoIds(): Promise<string[]> {
        try {
            const response = await api.get<string[]>('/saved-videos/ids');
            return response.data;
        } catch {
            return [];
        }
    },

    /**
     * Save a video
     */
    async saveVideo(videoId: string): Promise<void> {
        await api.post(`/saved-videos/${videoId}`);
    },

    /**
     * Unsave a video
     */
    async unsaveVideo(videoId: string): Promise<void> {
        await api.delete(`/saved-videos/${videoId}`);
    },

    /**
     * Toggle save status of a video
     */
    async toggleSaveVideo(videoId: string, currentlySaved: boolean): Promise<boolean> {
        if (currentlySaved) {
            await this.unsaveVideo(videoId);
            return false;
        } else {
            await this.saveVideo(videoId);
            return true;
        }
    },
};

export interface CreateVideoDto {
    title: string;
    description?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    hskLevel: number;
    category?: string;
    accent?: string;
    subtitleLanguages?: string[];
    xpReward?: number;
}

export interface YouTubeVideoInfoResponse {
    success: boolean;
    configured: boolean;
    error?: string;
    data?: {
        videoId: string;
        title: string;
        description: string;
        thumbnailUrl: string;
        durationSeconds: number;
        channelTitle: string;
    };
}

export default videoApi;
