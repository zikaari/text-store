/**
 * Super performant text container built upon caches
 *
 * Quick Notes:
 * When interacting using `ITextPosition`s, keep in mind that lowest value is `{ line: 1, col: 1 }`
 * When using indices, lowest value is 0.
 *
 * `{ line: 1, col: 1 }` === Index 0
 *
 * Also remember that most operations that accept `ITextPosition`, `ITextRange` and indices, require them
 * to be within document bounds. Only exception is `TextStore.prototype.getContents` which auto-clamps the range
 */
declare class TextStore {
    private str;
    private lines;
    private size;
    private indexToPosCache;
    private lineToIndexCache;
    /**
     * Retruns a new interactive `TextStore` built off of given string
     *
     * @param str Initial string to build store off of
     */
    constructor(str: string);
    /**
     * Inserts given string at given `ITextPosition`
     *
     * @param str String to insert
     * @param at `ITextPosition` where string should be inserted
     */
    insert(str: string, at: ITextPosition): void;
    /**
     * Replaces a `ITextRange` with given string
     *
     * @param range `ITextRange` to replace
     * @param str The replacement string itself
     */
    replace(range: ITextRange, str: string): void;
    /**
     * Removes a section of text specified by `ITextRange`
     *
     * @param range `ITextRange` to remove
     */
    remove(range: ITextRange): void;
    /**
     * Returns size of text buffer.
     *
     * Very efficient, as the value is returned from up-to-date cache
     */
    getSize(): number;
    /**
     * Returns contents of the buffer, optionally specify `ITextRange` to get a slice
     *
     * If indices are known, it might be performant to get contents without
     * any arguments and then using using `String.prototype.slice` instead.
     * @param range [Optional] `ITextRange` slice/fragment to return
     */
    getContents(range?: ITextRange): string;
    /**
     * Returns `ITextPosition` from zero-based index
     *
     * When index = 0, `ITextPosition` returned is `{ line: 1, col: 1 }`
     * @param index Zero based index of associated text buffer
     */
    indexToPosition(index: number): ITextPosition;
    /**
     * Returns zero based index of the associated text buffer from `ITextPosition`
     *
     * @param pos `ITextPosition`, min value: `{ line: 1, col: 1 }`
     */
    positionToIndex(pos: ITextPosition): number;
    private zeroBasedPosToIndex(zeroBasedPos);
    private convertPosToZeroBased(pos);
    private checkTextPosition(pos);
    private clampTextPosition(pos);
    /**
     * Purges cache following a position
     * @param from Zero based TextPosition
     */
    private flushCache(from);
    private roundToLowerBlockSize(index);
    /**
     * Binary kinda search to find highest cached index to pos record between a range
     * @param start
     * @param end
     */
    private findHighestCachedIndexToPos(start, end);
    /**
     * Binary kinda search to find highest cached index to pos record between a range
     * @param start
     * @param end
     */
    private findHighestCachedLineToIndex(start, end);
}
export interface ITextPosition {
    line: number;
    col: number;
}
export interface ITextRange {
    start: ITextPosition;
    end: ITextPosition;
}
export default TextStore;
