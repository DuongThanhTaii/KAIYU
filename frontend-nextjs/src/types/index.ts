// Theme types for the application
export interface ThemeColors {
    primary: string;
    primaryHover: string;
    backgroundLight: string;
    backgroundDark: string;
    surfaceDark: string;
    surfaceHighlight: string;
    borderColor: string;
    textSecondary: string;
    onPrimary: string;
}

// User types
export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    hskLevel: number;
    streak: number;
    xp: number;
    dailyGoalMinutes: number;
    isPremium: boolean;
}

// Vocabulary types
export interface VocabWord {
    id: string;
    hanzi: string;
    pinyin: string;
    meaning: string;
    meaningVi?: string;
    partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'other';
    hskLevel: number;
    tags: string[];
    proficiency: 'new' | 'learning' | 'review' | 'mastered';
    proficiencyPercent: number;
    audioUrl?: string;
    examples?: VocabExample[];
}

export interface VocabExample {
    hanzi: string;
    pinyin: string;
    meaning: string;
    meaningVi?: string;
}

// Video types
export interface Video {
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    duration: number; // in seconds
    hskLevel: number;
    category: string;
    accent?: string;
    subtitleLanguages: string[];
    views: number;
    progress?: number; // 0-100
    vocabCount: number;
    xpReward: number;
}

export interface Subtitle {
    id: string;
    startTime: number;
    endTime: number;
    hanzi: string;
    pinyin: string;
    meaning: string;
    meaningVi?: string;
    tokens: SubtitleToken[];
}

export interface SubtitleToken {
    hanzi: string;
    pinyin: string;
    meaning: string;
    hskLevel?: number;
    partOfSpeech?: string;
}

// Flashcard types
export interface Flashcard {
    id: string;
    word: VocabWord;
    nextReview: Date;
    interval: number; // days
    easeFactor: number;
    reviewCount: number;
    status: 'new' | 'learning' | 'review';
}

export type SRSRating = 'again' | 'hard' | 'good' | 'easy';

// Achievement types
export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    iconColor: string;
    xpReward: number;
    dateEarned?: Date;
}

// Navigation types
export interface NavItem {
    label: string;
    path: string;
    icon: string;
    badge?: number;
}
