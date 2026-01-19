import api from './api';

// Types
export interface Achievement {
    id: string;
    code: string;
    title: string;
    description: string | null;
    icon: string | null;
    iconColor: string | null;
    xpReward: number;
    earnedAt: string | null;
    currentValue?: number;
    targetValue?: number;
}

// Achievements API
export const achievementsApi = {
    /**
     * Get all achievements with user's earned status
     */
    async getUserAchievements(): Promise<Achievement[]> {
        const response = await api.get<Achievement[]>('/achievements');
        return response.data;
    },

    /**
     * Get only earned achievements (for dashboard)
     */
    async getEarnedAchievements(): Promise<Achievement[]> {
        const response = await api.get<Achievement[]>('/achievements/earned');
        return response.data;
    },

    /**
     * Get all available achievements (public)
     */
    async getAllAchievements(): Promise<Achievement[]> {
        const response = await api.get<Achievement[]>('/achievements/all');
        return response.data;
    },

    /**
     * Check and award any new achievements
     */
    async checkAchievements(): Promise<Achievement[]> {
        const response = await api.post<Achievement[]>('/achievements/check');
        return response.data;
    },
};

export default achievementsApi;
