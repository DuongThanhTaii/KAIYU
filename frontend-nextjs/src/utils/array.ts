/**
 * Reorders an item in an array from a source index to a target index.
 * 
 * @param list The array to reorder
 * @param sourceIndex The starting index of the item
 * @param targetIndex The desired ending index of the item
 * @returns A new array with the item moved and its position property updated
 */
export const reorderTokens = <T extends { position: number }>(
    list: T[],
    sourceIndex: number,
    targetIndex: number
): T[] => {
    if (sourceIndex === targetIndex) return list;

    const result = Array.from(list);
    const [removed] = result.splice(sourceIndex, 1);
    result.splice(targetIndex, 0, removed);

    return result.map((item, index) => ({
        ...item,
        position: index,
    }));
};
