import { describe, it, expect } from 'vitest';
import { checkSequenceConflict } from './subtitle';

describe('checkSequenceConflict', () => {
    const originalSentence = '我喜欢学习中文';
    
    it('should return false when tokens match the original sentence exactly', () => {
        const tokens = [
            { hanzi: '我' },
            { hanzi: '喜欢' },
            { hanzi: '学习' },
            { hanzi: '中文' }
        ];
        expect(checkSequenceConflict(tokens, originalSentence, false)).toBe(false);
    });

    it('should return false when tokens match but have different internal grouping', () => {
        const tokens = [
            { hanzi: '我' },
            { hanzi: '喜' },
            { hanzi: '欢' },
            { hanzi: '学习' },
            { hanzi: '中文' }
        ];
        expect(checkSequenceConflict(tokens, originalSentence, false)).toBe(false);
    });

    it('should return true when tokens are in a different order', () => {
        const tokens = [
            { hanzi: '我' },
            { hanzi: '学习' },
            { hanzi: '喜欢' },
            { hanzi: '中文' }
        ];
        expect(checkSequenceConflict(tokens, originalSentence, false)).toBe(true);
    });

    it('should return false when conflict is already confirmed', () => {
        const tokens = [
            { hanzi: '我' },
            { hanzi: '学习' },
            { hanzi: '喜欢' },
            { hanzi: '中文' }
        ];
        expect(checkSequenceConflict(tokens, originalSentence, true)).toBe(false);
    });

    it('should return true when a word is missing', () => {
        const tokens = [
            { hanzi: '我' },
            { hanzi: '喜欢' },
            { hanzi: '中文' }
        ];
        expect(checkSequenceConflict(tokens, originalSentence, false)).toBe(true);
    });

    it('should handle spaces gracefully', () => {
        const sentenceWithSpaces = ' 我 喜欢 学习 中文 ';
        const tokens = [
            { hanzi: '我' },
            { hanzi: '喜欢' },
            { hanzi: '学习' },
            { hanzi: '中文' }
        ];
        expect(checkSequenceConflict(tokens, sentenceWithSpaces, false)).toBe(false);
    });
});
