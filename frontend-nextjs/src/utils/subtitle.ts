/**
 * Checks if the current reordered tokens still form the same sentence as the original.
 * returns true if there is a conflict that hasn't been confirmed.
 */
export const checkSequenceConflict = (
    currentTokens: { hanzi: string }[],
    originalSentence: string,
    hasConfirmed: boolean
): boolean => {
    if (!originalSentence) return false;
    
    const currentFullHanzi = currentTokens.map(t => t.hanzi).join('');
    // Clean up both for comparison (remove spaces/control chars)
    const normalizedCurrent = currentFullHanzi.replace(/\s+/g, '');
    const normalizedOriginal = originalSentence.replace(/\s+/g, '');
    
    return normalizedCurrent !== normalizedOriginal && !hasConfirmed;
};
