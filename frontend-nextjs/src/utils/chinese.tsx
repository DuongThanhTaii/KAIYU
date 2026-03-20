import { POS_COLORS } from "@/constants/vocabulary";
import React from "react";

/**
 * Initialize native Chinese word segmenter
 */
export const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
    : null;

/**
 * Helper to group Pinyin syllables to match Hanzi word segmentation
 * Syllables of a single word will be joined without spaces.
 * Spaces will be kept between distinct words/segments.
 */
export const renderGroupedPinyin = (hanzi: string, pinyin: string, tokens?: any[]) => {
    if (!pinyin) return pinyin;

    // IF explicit tokens exist (admin re-segmented), use their pinyin directly
    if (tokens && tokens.length > 0) {
        return tokens.map(t => (t.pinyin || t.pinyinDisplay || '')).join(' ').replace(/\s+/g, ' ').trim();
    }

    if (!segmenter || !hanzi) return pinyin;

    // Split pinyin into syllables, but separate punctuation first to avoid "ba!" being one syllable
    const syllables = pinyin
        .replace(/([,.;!?，。！？])/g, ' $1 ')
        .split(/\s+/)
        .filter(s => s.trim() !== '');
    const segments = Array.from(segmenter.segment(hanzi));
    const groupedPinyin: string[] = [];
    let syllableIndex = 0;

    // Punctuation normalization for matching
    const normalizePunc = (s: string) => s.replace(/[，。！？、,.;!? ]/g, (m) => {
        const map: any = { '，': ',', '。': '.', '！': '!', '？': '?', '、': ',', ' ': '' };
        return map[m] || m;
    }).trim();

    for (const seg of segments) {
        const word = seg.segment;
        const charCount = word.length;

        if (seg.isWordLike) {
            // Take n syllables corresponding to the word's character count
            if (syllableIndex < syllables.length) {
                // Peek ahead: if the symbols in the pinyin are actually punctuation that matches 
                // the START of this word (weird but possible), skip them? 
                // Usually it's character matching.
                const wordPinyin = syllables.slice(syllableIndex, syllableIndex + charCount).join('');
                if (wordPinyin) {
                    groupedPinyin.push(wordPinyin);
                }
                syllableIndex += charCount;
            }
        } else {
            // For punctuation/whitespace
            const cleanWord = word.trim();
            if (cleanWord === '') {
                // Internal space in Hanzi - keep as a potential indicator but we'll join later
            } else {
                // Punctuation like "," or "!"
                // If the next syllable in our Pinyin matches this punctuation, consume it to avoid duplicates
                const currentSyllable = syllables[syllableIndex];
                if (currentSyllable && normalizePunc(currentSyllable) === normalizePunc(word)) {
                    syllableIndex++;
                }
                groupedPinyin.push(word);
            }
        }
    }

    // Append any leftover syllables to ensure no data loss
    if (syllableIndex < syllables.length) {
        const leftovers = syllables.slice(syllableIndex).join(' ');
        if (leftovers) groupedPinyin.push(leftovers);
    }

    // Join with space and then clean up spaces before punctuation
    return groupedPinyin.join(' ')
        .replace(/\s+([,.;!?，。！？])/g, '$1') // No space before punctuation
        .replace(/([,.;!?，。！？])\s*(?=[,.;!?，。！？])/g, '$1') // No space between consecutive punctuation
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Helper for case-insensitive POS_COLORS lookup
 */
export const getPosColor = (pos: string) => {
    if (!pos) return 'text-text-secondary';
    // Find key case-insensitively
    const key = Object.keys(POS_COLORS).find(k => k.toLowerCase() === pos.toLowerCase());
    return key ? POS_COLORS[key] : 'text-text-secondary';
};

/**
 * Format a Vietnamese meaning line by removing numbering and colorizing the part of speech
 */
export const renderFormattedMeaning = (text: string) => {
    // 1. Strip leading number (e.g., "1. ", " 2. ")
    const cleanText = text.replace(/^\s*\d+\.\s*/, '').trim();

    // 2. Look for part of speech at the beginning before a colon
    const match = cleanText.match(/^([^:]+):/);
    if (match) {
        const pos = match[1].trim();
        const meaning = cleanText.substring(match[0].length).trim();
        const colorClass = getPosColor(pos);

        return (
            <React.Fragment>
                <span className={`${colorClass} font-bold mr-2 whitespace-nowrap`}>{pos}:</span>
                <span className="text-text-base">{meaning}</span>
            </React.Fragment>
        );
    }

    return <span className="text-text-base">{cleanText}</span>;
}

/**
 * Highlight a specific word/phrase within a sentence
 */
export const highlightWord = (text: string, target: string, className: string = "text-primary font-bold") => {
    if (!text || !target) return text;

    // Use regex for case-insensitive matching if it's Pinyin (alphabetic)
    // For Hanzi, exact match is usually better
    const isPinyin = /^[a-zA-Záéíóúüāēīōūǖǎěǐǒǔǚàèìòùǜ\s,.;!?，。！？]+$/.test(target);
    
    // Escape target for regex
    const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTarget})`, isPinyin ? 'gi' : 'g');
    
    const parts = text.split(regex);
    
    return (
        <>
            {parts.map((part, i) => 
                part.toLowerCase() === target.toLowerCase() ? (
                    <span key={i} className={className}>{part}</span>
                ) : (
                    part
                )
            )}
        </>
    );
};
