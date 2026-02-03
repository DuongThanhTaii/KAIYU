// Admin API Service
// Note: Uses the same API base URL as the main api.ts client

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Helper function to get auth token - matches the token key in api.ts
const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

// Generic fetch wrapper with error handling
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            ...getAuthHeaders(),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Có lỗi xảy ra' }));
        throw new Error(error.message || 'Có lỗi xảy ra');
    }

    return response.json();
}

// ============ Types ============
export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface OverviewStats {
    users: number;
    videos: number;
    publishedVideos: number;
    vocabulary: number;
    recentUsers: {
        id: string;
        name: string;
        email: string;
        createdAt: string;
    }[];
    todayLearningCount: number;
    dailyActivity: {
        date: string;
        label: string;
        newUsers: number;
        videoViews: number;
    }[];
}

export interface Video {
    id: string;
    title: string;
    description?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    durationSeconds: number;
    hskLevel: number;
    category?: string;
    accent?: string;
    subtitleLanguages: string[];
    viewCount: number;
    vocabCount: number;
    xpReward: number;
    isPublished: boolean;
    createdAt: string;
    _count?: {
        subtitles: number;
    };
}

export interface Vocabulary {
    id: string;
    hanzi: string;
    pinyin: string;
    meaningVi: string;
    meaningEn?: string;
    radical?: string;
    radicalMeaning?: string;
    strokeCount?: number;
    partOfSpeech?: string;
    hskLevel: number;
    tags: string[];
    audioUrl?: string;
    examples?: { chinese: string; pinyin?: string; vietnamese: string }[];
    synonyms?: { hanzi: string; pinyin: string; meaningVi: string }[];
    antonyms?: { hanzi: string; pinyin: string; meaningVi: string }[];
    mnemonic?: string;
    createdAt: string;
    updatedAt?: string;
}

// Import vocabulary item (flat format for XLSX)
export interface ImportVocabularyItem {
    hanzi: string;
    pinyin: string;
    meaningVi: string;
    meaningEn?: string;
    radical?: string;
    radicalMeaning?: string;
    strokeCount?: number;
    partOfSpeech?: string;
    hskLevel: number;
    tags?: string[];
    example1_cn?: string;
    example1_py?: string;
    example1_vi?: string;
    example2_cn?: string;
    example2_py?: string;
    example2_vi?: string;
    synonym1?: string;
    synonym1_py?: string;
    synonym1_vi?: string;
    antonym1?: string;
    antonym1_py?: string;
    antonym1_vi?: string;
    mnemonic?: string;
}

export interface AdminUser {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    hskLevel: number;
    streak: number;
    isPremium: boolean;
    role: string;
    createdAt: string;
    _count?: {
        userVocabulary: number;
    };
}

export interface Subtitle {
    startTime: number;
    endTime: number;
    hanzi: string;
    pinyin: string;
    meaningEn?: string;
    meaningVi?: string;
}

// ============ Dashboard ============
export const getOverviewStats = (): Promise<OverviewStats> => {
    return apiRequest<OverviewStats>('/admin/stats/overview');
};

// ============ Notifications ============
export interface AdminNotification {
    id: string;
    type: 'user' | 'video' | 'achievement' | 'vocabulary';
    message: string;
    time: string;
}

export const getNotifications = (limit: number = 10): Promise<AdminNotification[]> => {
    return apiRequest<AdminNotification[]>(`/admin/notifications?limit=${limit}`);
};

// ============ Activity Stats ============
export interface ActivityData {
    date: string;
    label: string;
    newUsers: number;
    videoViews: number;
}

export const getActivityStats = (days: number = 7): Promise<ActivityData[]> => {
    return apiRequest<ActivityData[]>(`/admin/stats/activity?days=${days}`);
};

// ============ Video Management ============
export const getAllVideos = (
    params: { page?: number; limit?: number; isPublished?: boolean } = {}
): Promise<PaginatedResponse<Video>> => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.isPublished !== undefined) searchParams.set('isPublished', String(params.isPublished));

    const query = searchParams.toString();
    return apiRequest<PaginatedResponse<Video>>(`/admin/videos${query ? `?${query}` : ''}`);
};

export const createVideo = (data: Partial<Video>): Promise<Video> => {
    return apiRequest<Video>('/admin/videos', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const updateVideo = (id: string, data: Partial<Video>): Promise<Video> => {
    return apiRequest<Video>(`/admin/videos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
};

export const deleteVideo = (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/admin/videos/${id}`, {
        method: 'DELETE',
    });
};

export const publishVideo = (id: string): Promise<Video> => {
    return apiRequest<Video>(`/admin/videos/${id}/publish`, {
        method: 'POST',
    });
};

export const addSubtitles = (
    videoId: string,
    subtitles: Subtitle[]
): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/admin/videos/${videoId}/subtitles`, {
        method: 'POST',
        body: JSON.stringify({ subtitles }),
    });
};

// ============ Vocabulary Management ============
export const getAllVocabulary = (
    params: { page?: number; limit?: number; hskLevel?: number } = {}
): Promise<PaginatedResponse<Vocabulary>> => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.hskLevel) searchParams.set('hskLevel', String(params.hskLevel));

    const query = searchParams.toString();
    return apiRequest<PaginatedResponse<Vocabulary>>(`/admin/vocabulary${query ? `?${query}` : ''}`);
};

export const createVocabulary = (data: Partial<Vocabulary>): Promise<Vocabulary> => {
    return apiRequest<Vocabulary>('/admin/vocabulary', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const updateVocabulary = (id: string, data: Partial<Vocabulary>): Promise<Vocabulary> => {
    return apiRequest<Vocabulary>(`/admin/vocabulary/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
};

export const deleteVocabulary = (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/admin/vocabulary/${id}`, {
        method: 'DELETE',
    });
};

export const importVocabulary = (
    items: ImportVocabularyItem[]
): Promise<{ created: number; skipped: number; errors: number; errorDetails?: { hanzi: string; error: string }[] }> => {
    return apiRequest<{ created: number; skipped: number; errors: number; errorDetails?: { hanzi: string; error: string }[] }>('/vocabulary/import', {
        method: 'POST',
        body: JSON.stringify(items),
    });
};

export const bulkUpdateVocabulary = (
    items: ImportVocabularyItem[]
): Promise<{ updated: number; skipped: number; errors: number; errorDetails?: { hanzi: string; error: string }[] }> => {
    return apiRequest<{ updated: number; skipped: number; errors: number; errorDetails?: { hanzi: string; error: string }[] }>('/vocabulary/bulk-update', {
        method: 'POST',
        body: JSON.stringify(items),
    });
};


// ============ User Management ============
export const getAllUsers = (
    params: { page?: number; limit?: number; role?: string } = {}
): Promise<PaginatedResponse<AdminUser>> => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.role) searchParams.set('role', params.role);

    const query = searchParams.toString();
    return apiRequest<PaginatedResponse<AdminUser>>(`/admin/users${query ? `?${query}` : ''}`);
};

export const updateUserRole = (
    id: string,
    role: string
): Promise<{ id: string; email: string; name: string; role: string }> => {
    return apiRequest<{ id: string; email: string; name: string; role: string }>(`/admin/users/${id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
    });
};

export const deleteUser = (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/admin/users/${id}`, {
        method: 'DELETE',
    });
};

// ============ Achievement Management ============
export interface Achievement {
    id: string;
    code: string;
    title: string;
    description?: string;
    icon?: string;
    iconColor?: string;
    xpReward: number;
    earnedCount?: number;
}

export const getAllAchievements = (
    params: { page?: number; limit?: number } = {}
): Promise<PaginatedResponse<Achievement>> => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    return apiRequest<PaginatedResponse<Achievement>>(`/admin/achievements${query ? `?${query}` : ''}`);
};

export const createAchievement = (data: {
    code: string;
    title: string;
    description?: string;
    icon?: string;
    iconColor?: string;
    xpReward?: number;
}): Promise<Achievement> => {
    return apiRequest<Achievement>('/admin/achievements', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const updateAchievement = (
    id: string,
    data: {
        code?: string;
        title?: string;
        description?: string;
        icon?: string;
        iconColor?: string;
        xpReward?: number;
    }
): Promise<Achievement> => {
    return apiRequest<Achievement>(`/admin/achievements/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
};

export const deleteAchievement = (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/admin/achievements/${id}`, {
        method: 'DELETE',
    });
};

// ============ Upload Status ============
export const getUploadStatus = (): Promise<{ s3Configured: boolean; message: string }> => {
    return apiRequest<{ s3Configured: boolean; message: string }>('/upload/status');
};

// ============ File Upload (for cloud storage option) ============
export const uploadFile = async (
    file: File,
    type: 'video' | 'image'
): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    const response = await fetch(`${BASE_URL}/upload/${type}`, {
        method: 'POST',
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || 'Upload failed');
    }

    return response.json();
};

// Upload with progress callback
export const uploadFileWithProgress = async (
    file: File,
    type: 'video' | 'image',
    onProgress?: (percent: number) => void
): Promise<{ url: string }> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                try {
                    const error = JSON.parse(xhr.responseText);
                    reject(new Error(error.message || 'Upload failed'));
                } catch {
                    reject(new Error('Upload failed'));
                }
            }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));

        const token = localStorage.getItem('token');
        xhr.open('POST', `${BASE_URL}/upload/${type}`);
        if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formData);
    });
};

// ============ Export/Import Utilities ============
export const exportToJSON = <T>(data: T[], filename: string): void => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

export const exportToCSV = <T extends Record<string, any>>(
    data: T[],
    filename: string,
    columns: { key: keyof T; header: string }[]
): void => {
    const headers = columns.map((c) => c.header).join(',');
    const rows = data.map((item) =>
        columns.map((c) => {
            const value = item[c.key];
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? '';
        }).join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

export const parseCSV = <T>(csvText: string, columns: { key: keyof T; header: string }[]): Partial<T>[] => {
    const lines = csvText.split('\n').filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim());
    const headerMap = new Map(columns.map((c) => [c.header, c.key]));

    return lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const item: Partial<T> = {};
        headers.forEach((header, index) => {
            const key = headerMap.get(header);
            if (key && values[index] !== undefined) {
                (item as any)[key] = values[index];
            }
        });
        return item;
    });
};
