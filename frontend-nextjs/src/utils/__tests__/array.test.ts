import { describe, it, expect } from 'vitest';
import { reorderTokens } from '../array';

describe('reorderTokens', () => {
    const mockTokens = [
        { hanzi: 'A', position: 0 },
        { hanzi: 'B', position: 1 },
        { hanzi: 'C', position: 2 },
        { hanzi: 'D', position: 3 },
    ];

    it('should move an item from start to end', () => {
        const result = reorderTokens(mockTokens, 0, 3);
        expect(result.map(t => t.hanzi)).toEqual(['B', 'C', 'D', 'A']);
        expect(result.map(t => t.position)).toEqual([0, 1, 2, 3]);
    });

    it('should move an item from end to start', () => {
        const result = reorderTokens(mockTokens, 3, 0);
        expect(result.map(t => t.hanzi)).toEqual(['D', 'A', 'B', 'C']);
        expect(result.map(t => t.position)).toEqual([0, 1, 2, 3]);
    });

    it('should move an item from 0 to 2 (middle)', () => {
        const result = reorderTokens(mockTokens, 0, 2);
        // [A, B, C, D] -> [B, C, A, D]
        expect(result.map(t => t.hanzi)).toEqual(['B', 'C', 'A', 'D']);
    });

    it('should move an item from 2 to 0 (middle back)', () => {
        const result = reorderTokens(mockTokens, 2, 0);
        // [A, B, C, D] -> [C, A, B, D]
        expect(result.map(t => t.hanzi)).toEqual(['C', 'A', 'B', 'D']);
    });

    it('should return same array if source and target are same', () => {
        const result = reorderTokens(mockTokens, 1, 1);
        expect(result).toEqual(mockTokens);
    });

    it('should swap adjacent items correctly (0 to 1)', () => {
        const result = reorderTokens(mockTokens, 0, 1);
        expect(result.map(t => t.hanzi)).toEqual(['B', 'A', 'C', 'D']);
    });

    it('should swap adjacent items correctly (1 to 0)', () => {
        const result = reorderTokens(mockTokens, 1, 0);
        expect(result.map(t => t.hanzi)).toEqual(['B', 'A', 'C', 'D']);
    });

    it('should handle dragging a token to the very end of a 2-item list', () => {
        const smallList = [{ hanzi: 'A', position: 0 }, { hanzi: 'B', position: 1 }];
        const result = reorderTokens(smallList, 0, 1);
        expect(result.map(t => t.hanzi)).toEqual(['B', 'A']);
    });
});
