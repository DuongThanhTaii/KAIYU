import api from './api';

// Types
export interface VideoNote {
    id: string;
    userId: string;
    videoId: string;
    timestampSec: number;
    content: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateNoteData {
    videoId: string;
    timestampSec: number;
    content: string;
}

export interface UpdateNoteData {
    content?: string;
    timestampSec?: number;
}

// Video Notes API (requires authentication)
export const videoNotesApi = {
    /**
     * Get all notes for a specific video
     */
    async getByVideoId(videoId: string): Promise<VideoNote[]> {
        const response = await api.get<VideoNote[]>(`/video-notes/${videoId}`);
        return response.data;
    },

    /**
     * Create a new note
     */
    async create(data: CreateNoteData): Promise<VideoNote> {
        const response = await api.post<VideoNote>('/video-notes', data);
        return response.data;
    },

    /**
     * Update an existing note
     */
    async update(id: string, data: UpdateNoteData): Promise<VideoNote> {
        const response = await api.put<VideoNote>(`/video-notes/${id}`, data);
        return response.data;
    },

    /**
     * Delete a note
     */
    async delete(id: string): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(`/video-notes/${id}`);
        return response.data;
    },
};

export default videoNotesApi;
