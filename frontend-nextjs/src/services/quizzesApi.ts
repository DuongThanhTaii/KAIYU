import api from './api';

// Types
export interface QuizQuestion {
    id: string;
    quizId: string;
    sentenceHanzi: string;
    blankWord: string;
    blankPosition: number;
    options: string[];
    meaningVi?: string;
    sequenceOrder: number;
    subtitleId?: string;
}

export interface VideoQuiz {
    id: string;
    videoId: string;
    title: string;
    description?: string;
    isPublished: boolean;
    createdAt: string;
    updatedAt: string;
    questions: QuizQuestion[];
    video?: {
        id: string;
        title: string;
        hskLevel: number;
    };
}

export interface CreateQuestionDto {
    sentenceHanzi: string;
    blankWord: string;
    blankPosition: number;
    options: string[];
    meaningVi?: string;
    sequenceOrder: number;
    subtitleId?: string;
}

export interface UpdateQuestionDto {
    sentenceHanzi?: string;
    blankWord?: string;
    blankPosition?: number;
    options?: string[];
    meaningVi?: string;
    sequenceOrder?: number;
}

export interface UpdateQuizDto {
    title?: string;
    description?: string;
    isPublished?: boolean;
}

// Quiz API
export const quizzesApi = {
    // Get quiz by video ID
    async getByVideoId(videoId: string): Promise<VideoQuiz | null> {
        try {
            const response = await api.get<VideoQuiz>(`/quizzes/video/${videoId}`);
            return response.data;
        } catch {
            return null;
        }
    },

    // Get quiz by ID
    async getById(quizId: string): Promise<VideoQuiz> {
        const response = await api.get<VideoQuiz>(`/quizzes/${quizId}`);
        return response.data;
    },

    // Generate quiz from video subtitles (Admin)
    async generate(videoId: string): Promise<VideoQuiz> {
        const response = await api.post<VideoQuiz>(`/quizzes/generate/${videoId}`);
        return response.data;
    },

    // Create quiz manually (Admin)
    async create(videoId: string, title?: string): Promise<VideoQuiz> {
        const response = await api.post<VideoQuiz>(`/quizzes`, { videoId, title });
        return response.data;
    },

    // Update quiz (Admin)
    async update(quizId: string, data: UpdateQuizDto): Promise<VideoQuiz> {
        const response = await api.put<VideoQuiz>(`/quizzes/${quizId}`, data);
        return response.data;
    },

    // Publish quiz (Admin)
    async publish(quizId: string): Promise<VideoQuiz> {
        const response = await api.post<VideoQuiz>(`/quizzes/${quizId}/publish`);
        return response.data;
    },

    // Delete quiz (Admin)
    async delete(quizId: string): Promise<void> {
        await api.delete(`/quizzes/${quizId}`);
    },

    // Add question (Admin)
    async addQuestion(quizId: string, data: CreateQuestionDto): Promise<QuizQuestion> {
        const response = await api.post<QuizQuestion>(`/quizzes/${quizId}/questions`, data);
        return response.data;
    },

    // Update question (Admin)
    async updateQuestion(questionId: string, data: UpdateQuestionDto): Promise<QuizQuestion> {
        const response = await api.put<QuizQuestion>(`/quizzes/questions/${questionId}`, data);
        return response.data;
    },

    // Delete question (Admin)
    async deleteQuestion(questionId: string): Promise<void> {
        await api.delete(`/quizzes/questions/${questionId}`);
    },
};

export default quizzesApi;
