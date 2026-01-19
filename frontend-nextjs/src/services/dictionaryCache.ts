'use client';

import { LookupResult, EnrichedWordData } from './dictionaryApi';

const CACHE_PREFIX = 'dict_cache_';
const HISTORY_KEY = 'dict_history';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ITEMS = 500;
const MAX_HISTORY_ITEMS = 50;

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface HistoryItem {
    word: string;
    pinyin: string;
    meaning: string;
    timestamp: number;
}

/**
 * Dictionary Cache Service using localStorage
 */
export const dictionaryCache = {
    /**
     * Get cached lookup result
     */
    getLookup(word: string): LookupResult | null {
        if (typeof window === 'undefined') return null;
        try {
            const key = `${CACHE_PREFIX}lookup_${word}`;
            const cached = localStorage.getItem(key);
            if (!cached) return null;

            const entry: CacheEntry<LookupResult> = JSON.parse(cached);
            if (Date.now() - entry.timestamp > CACHE_TTL) {
                localStorage.removeItem(key);
                return null;
            }
            return entry.data;
        } catch {
            return null;
        }
    },

    /**
     * Set cached lookup result
     */
    setLookup(word: string, data: LookupResult): void {
        if (typeof window === 'undefined') return;
        try {
            const key = `${CACHE_PREFIX}lookup_${word}`;
            const entry: CacheEntry<LookupResult> = {
                data,
                timestamp: Date.now(),
            };
            localStorage.setItem(key, JSON.stringify(entry));
            this.cleanupIfNeeded();

            // Add to history
            if (data.found) {
                this.addToHistory({
                    word,
                    pinyin: data.pinyinDisplay || data.pinyin || '',
                    meaning: data.meaningVi || data.meaningEn || '',
                    timestamp: Date.now(),
                });
            }
        } catch {
            // Storage full - cleanup and retry
            this.cleanupOldEntries();
        }
    },

    /**
     * Get cached enriched data
     */
    getEnriched(word: string): EnrichedWordData | null {
        if (typeof window === 'undefined') return null;
        try {
            const key = `${CACHE_PREFIX}enrich_${word}`;
            const cached = localStorage.getItem(key);
            if (!cached) return null;

            const entry: CacheEntry<EnrichedWordData> = JSON.parse(cached);
            if (Date.now() - entry.timestamp > CACHE_TTL) {
                localStorage.removeItem(key);
                return null;
            }
            return entry.data;
        } catch {
            return null;
        }
    },

    /**
     * Set cached enriched data
     */
    setEnriched(word: string, data: EnrichedWordData): void {
        if (typeof window === 'undefined') return;
        try {
            const key = `${CACHE_PREFIX}enrich_${word}`;
            const entry: CacheEntry<EnrichedWordData> = {
                data,
                timestamp: Date.now(),
            };
            localStorage.setItem(key, JSON.stringify(entry));
        } catch {
            this.cleanupOldEntries();
        }
    },

    /**
     * Get lookup history
     */
    getHistory(): HistoryItem[] {
        if (typeof window === 'undefined') return [];
        try {
            const cached = localStorage.getItem(HISTORY_KEY);
            if (!cached) return [];
            return JSON.parse(cached);
        } catch {
            return [];
        }
    },

    /**
     * Add item to history
     */
    addToHistory(item: HistoryItem): void {
        if (typeof window === 'undefined') return;
        try {
            let history = this.getHistory();
            // Remove duplicate
            history = history.filter(h => h.word !== item.word);
            // Add to front
            history.unshift(item);
            // Limit size
            history = history.slice(0, MAX_HISTORY_ITEMS);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        } catch {
            // Ignore
        }
    },

    /**
     * Clear all cache
     */
    clearAll(): void {
        if (typeof window === 'undefined') return;
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(CACHE_PREFIX) || key === HISTORY_KEY) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    },

    /**
     * Cleanup old entries if cache is too large
     */
    cleanupIfNeeded(): void {
        if (typeof window === 'undefined') return;
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(CACHE_PREFIX)) count++;
        }
        if (count > MAX_CACHE_ITEMS) {
            this.cleanupOldEntries();
        }
    },

    /**
     * Remove oldest cache entries
     */
    cleanupOldEntries(): void {
        if (typeof window === 'undefined') return;
        const entries: { key: string; timestamp: number }[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(CACHE_PREFIX)) {
                try {
                    const cached = localStorage.getItem(key);
                    if (cached) {
                        const entry = JSON.parse(cached);
                        entries.push({ key, timestamp: entry.timestamp || 0 });
                    }
                } catch {
                    // Remove invalid entries
                    if (key) localStorage.removeItem(key);
                }
            }
        }

        // Sort by timestamp and remove oldest 20%
        entries.sort((a, b) => a.timestamp - b.timestamp);
        const removeCount = Math.max(10, Math.floor(entries.length * 0.2));
        entries.slice(0, removeCount).forEach(e => localStorage.removeItem(e.key));
    },
};

export type { HistoryItem };
