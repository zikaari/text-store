/**
 * Super performant text container built upon caches
 *
 * When interacting using `TextPosition`s, keep in mind that lowest value is `{ line: 1, col: 1 }`
 * When using indices, lowest value is 0
 *
 * Also remember that most operations accepting `TextPosition`, `TextRange` and indices require them
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
     * Inserts given string at given `TextPosition`
     *
     * `TextPosition` cannot exceed document bounds, min value is `{ line: 1, col: 1 }`
     * @param str String to insert
     * @param at `TextPosition` where string should be inserted
     */
    insert(str: string, at: ITextPosition): void;
    /**
     * Replaces a `TextRange` with given string
     *
     * @param range `TextRange` to replace
     * @param str The replacement string itself
     */
    replace(range: ITextRange, str: string): void;
    /**
     * Removes a section of text specified by `TextRange`
     *
     * @param range `TextRange` to remove
     */
    remove(range: ITextRange): void;
    /**
     * Returns size of text buffer
     *
     * Similar to textStore.getContents().length, but this returns value from live cache
     */
    getSize(): number;
    /**
     * Returns contents of the buffer, optionally specify `TextRange` to get a slice
     *
     * If you know indices directly, it might be performant to getContents without
     * any arguments and then extracting the slice using `String.prototype.substr` etc.
     * @param range [Optional] `TextRange` you need
     */
    getContents(range?: ITextRange): string;
    /**
     * Returns `TextPosition` from zero-based index
     *
     * When index = 0, `TextPosition` returned is `{ line: 1, col: 1 }`
     * @param index Zero based index of associated text buffer
     */
    indexToPosition(index: number): ITextPosition;
    /**
     * Returns zero based index of the associated text buffer from `TextPosition`
     *
     * @param pos `TextPosition`, min value: `{ line: 1, col: 1 }`
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
