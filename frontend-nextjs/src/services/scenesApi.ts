import api from './api';
import axios from 'axios';

// Types
export interface SceneTemplate {
    id: string;
    name: string;
    nameVi: string;
    description: string | null;
    category: string;
    hskLevel: number;
    imageUrl: string | null;
    dialogFlow: DialogFlow;
    vocabSlots: string[];
    difficulty: string;
    usageCount: number;
}

export interface DialogFlow {
    [nodeId: string]: DialogNode;
}

export interface DialogNode {
    speaker: string;
    speakerVi: string;
    text: string;
    textVi: string;
    pinyin: string;
    choices?: DialogChoice[];
    isEnd?: boolean;
    score?: number;
}

export interface DialogChoice {
    id: string;
    text: string;
    textVi: string;
    next: string;
    correct?: boolean;
}

export interface GeneratedScene {
    id: string;
    templateId: string | null;
    vocabHash: string;
    dialogFlow: DialogFlow;
    injectedVocab: VocabSlots | null;
    isAIGenerated: boolean;
}

export interface VocabSlots {
    [slot: string]: {
        hanzi: string;
        pinyin: string;
        meaningVi: string;
    };
}

export interface SceneHistory {
    id: string;
    userId: string;
    templateId: string | null;
    sceneId: string | null;
    score: number | null;
    choicesMade: object | null;
    vocabUsed: string[];
    completedAt: string;
    template?: SceneTemplate;
}

export interface SceneStats {
    totalCompleted: number;
    averageScore: number;
    recentScenes: SceneHistory[];
}

// Helper function to get error message
const getErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        return error.response?.data?.message || error.message || 'Request failed';
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred';
};

// API Functions
export const scenesApi = {
    /**
     * Get all scene templates
     */
    async getTemplates(hskLevel?: number): Promise<SceneTemplate[]> {
        try {
            const params = hskLevel ? { hskLevel: hskLevel.toString() } : {};
            const response = await api.get('/scenes/templates', { params });
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Get a specific template
     */
    async getTemplate(id: string): Promise<SceneTemplate> {
        try {
            const response = await api.get(`/scenes/templates/${id}`);
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Generate a scene with vocabulary injection
     */
    async generateScene(templateId: string, vocabSlots: VocabSlots): Promise<GeneratedScene> {
        try {
            const response = await api.post('/scenes/generate', {
                templateId,
                vocabSlots,
            });
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Save scene completion history
     */
    async saveHistory(data: {
        templateId: string;
        sceneId?: string;
        score: number;
        choicesMade: object;
        vocabUsed: string[];
    }): Promise<SceneHistory> {
        try {
            const response = await api.post('/scenes/history', data);
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Get user's scene history
     */
    async getHistory(limit?: number): Promise<SceneHistory[]> {
        try {
            const params = limit ? { limit: limit.toString() } : {};
            const response = await api.get('/scenes/history', { params });
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Get user's scene stats
     */
    async getStats(): Promise<SceneStats> {
        try {
            const response = await api.get('/scenes/stats');
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Check AI generation rate limit
     */
    async checkRateLimit(): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
        try {
            const response = await api.get('/scenes/rate-limit');
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Generate a custom AI scene
     */
    async generateAiScene(data: {
        scenarioType: string;
        vocabularyToUse: { hanzi: string; pinyin: string; meaningVi: string }[];
        hskLevel: number;
    }): Promise<{ dialogFlow: DialogFlow; sceneId?: string; cached: boolean }> {
        try {
            const response = await api.post('/scenes/generate-ai', data);
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Get vocabulary suggestions from user's notebook
     */
    async getVocabSuggestions(count?: number): Promise<{ hanzi: string; pinyin: string; meaningVi: string }[]> {
        try {
            const params = count ? { count: count.toString() } : {};
            const response = await api.get('/scenes/vocab-suggestions', { params });
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Get vocabulary suggestions for a specific scenario
     */
    async getVocabSuggestionsForScenario(
        scenarioType: string,
        count?: number,
    ): Promise<{ hanzi: string; pinyin: string; meaningVi: string }[]> {
        try {
            const params = count ? { count: count.toString() } : {};
            const response = await api.get(`/scenes/vocab-suggestions/${scenarioType}`, { params });
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    // ===== Phase 3: Sharing & Analytics =====

    /**
     * Get trending/popular scenes
     */
    async getTrendingScenes(limit?: number): Promise<{
        id: string;
        title: string;
        scenarioType: string;
        playCount: number;
        avgScore: number;
        vocabUsed: string[];
        creatorName?: string;
    }[]> {
        try {
            const params = limit ? { limit: limit.toString() } : {};
            const response = await api.get('/scenes/trending', { params });
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Get public shared scenes
     */
    async getPublicScenes(limit?: number): Promise<GeneratedScene[]> {
        try {
            const params = limit ? { limit: limit.toString() } : {};
            const response = await api.get('/scenes/public', { params });
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Share a scene publicly
     */
    async shareScene(sceneId: string, title: string): Promise<GeneratedScene> {
        try {
            const response = await api.post(`/scenes/share/${sceneId}`, { title });
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Like a shared scene
     */
    async likeScene(sceneId: string): Promise<GeneratedScene> {
        try {
            const response = await api.post(`/scenes/like/${sceneId}`);
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Get popular vocabulary combinations
     */
    async getPopularVocabCombos(limit?: number): Promise<{
        vocab: string[];
        count: number;
        scenarioType: string;
    }[]> {
        try {
            const params = limit ? { limit: limit.toString() } : {};
            const response = await api.get('/scenes/popular-combos', { params });
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },
};

export default scenesApi;
