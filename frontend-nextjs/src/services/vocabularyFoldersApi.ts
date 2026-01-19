import api from './api';

export interface VocabularyFolder {
    id: string;
    userId: string;
    name: string;
    color?: string;
    icon?: string;
    isDefault: boolean;
    createdAt: string;
    _count?: {
        vocabulary: number;
    };
}

export interface CreateFolderDto {
    name: string;
    color?: string;
    icon?: string;
}

export interface UpdateFolderDto {
    name?: string;
    color?: string;
    icon?: string;
}

export const vocabularyFoldersApi = {
    /**
     * Get all folders for current user
     */
    async getAll(): Promise<VocabularyFolder[]> {
        const response = await api.get<VocabularyFolder[]>('/vocabulary-folders');
        return response.data;
    },

    /**
     * Create a new folder
     */
    async create(data: CreateFolderDto): Promise<VocabularyFolder> {
        const response = await api.post<VocabularyFolder>('/vocabulary-folders', data);
        return response.data;
    },

    /**
     * Get default folder (creates if not exists)
     */
    async getDefault(): Promise<VocabularyFolder> {
        const response = await api.get<VocabularyFolder>('/vocabulary-folders/default');
        return response.data;
    },

    /**
     * Get vocabulary in a folder
     */
    async getVocabulary(folderId: string): Promise<any[]> {
        const response = await api.get<any[]>(`/vocabulary-folders/${folderId}/vocabulary`);
        return response.data;
    },

    /**
     * Get uncategorized vocabulary
     */
    async getUncategorized(): Promise<any[]> {
        const response = await api.get<any[]>('/vocabulary-folders/uncategorized/vocabulary');
        return response.data;
    },

    /**
     * Update a folder
     */
    async update(id: string, data: UpdateFolderDto): Promise<VocabularyFolder> {
        const response = await api.patch<VocabularyFolder>(`/vocabulary-folders/${id}`, data);
        return response.data;
    },

    /**
     * Delete a folder
     */
    async delete(id: string): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(`/vocabulary-folders/${id}`);
        return response.data;
    },

    /**
     * Move vocabulary to a folder
     */
    async moveVocabulary(vocabId: string, folderId?: string): Promise<any> {
        const url = folderId
            ? `/vocabulary-folders/vocabulary/${vocabId}/move?folderId=${folderId}`
            : `/vocabulary-folders/vocabulary/${vocabId}/move`;
        const response = await api.post(url);
        return response.data;
    },
};

export default vocabularyFoldersApi;
