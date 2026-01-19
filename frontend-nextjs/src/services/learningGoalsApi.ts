import api from './api';

// Types
export interface SaveGoalsData {
    hskLevel?: number;
    dailyGoalMinutes?: number;
    interests?: string[];
}

export interface LearningGoals {
    hskLevel: number;
    dailyGoalMinutes: number;
    interests: (string | null)[];
}

// Learning Goals API
export const learningGoalsApi = {
    /**
     * Save learning goals from onboarding
     */
    async saveGoals(data: SaveGoalsData): Promise<{ message: string }> {
        const response = await api.post<{ message: string }>('/learning-goals', data);
        return response.data;
    },

    /**
     * Get user's learning goals
     */
    async getGoals(): Promise<LearningGoals> {
        const response = await api.get<LearningGoals>('/learning-goals');
        return response.data;
    },
};

export default learningGoalsApi;
