import * as clamp from 'clamp';

// Bigger block size = lower memory usage, higher compute cycles
const DEFAULT_BLOCK_SIZE = 10;

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
class TextStore {
    private str: string;
    private lines: string[];
    private size: number;
    private indexToPosCache: SCache<ITextPosition>;
    private lineToIndexCache: VCache<number>;

    /**
     * Retruns a new interactive `TextStore` built off of given string
     *
     * @param str Initial string to build store off of
     */
    constructor(str: string) {
        this.str = str;
        this.size = str.length;
        this.lines = str.split(/\n/);
        this.indexToPosCache = new SCache();
        this.lineToIndexCache = new VCache();
    }

    /**
     * Inserts given string at given `ITextPosition`
     *
     * @param str String to insert
     * @param at `ITextPosition` where string should be inserted
     */
    public insert(str: string, at: ITextPosition) {
        if (str.length === 0) {
            return;
        }
        const pos = this.convertPosToZeroBased(at);
        this.checkTextPosition(pos);
        this.flushCache(pos);
        this.size += str.length;
        const updated = this.lines[pos.line].slice(0, pos.col) + str + this.lines[pos.line].slice(pos.col);
        // Remove old line and insert updated line(s)
        this.lines.splice(pos.line, 1, ...updated.split(/\n/));
    }

    /**
     * Replaces a `ITextRange` with given string
     *
     * @param range `ITextRange` to replace
     * @param str The replacement string itself
     */
    public replace(range: ITextRange, str: string) {
        const start = this.convertPosToZeroBased(range.start);
        const end = this.convertPosToZeroBased(range.end);
        this.checkTextPosition(start);
        this.checkTextPosition(end);
        this.flushCache(start);
        const updated = this.lines[start.line].slice(0, start.col) + str + this.lines[end.line].slice(end.col);
        // Remove old line(s) and insert updated line(s)
        const removedLines = this.lines.splice(start.line, (end.line + 1) - start.line, ...updated.split(/\n/));
        this.size -= removedLines.join('\n').length;
        this.size += updated.length;
    }

    /**
     * Removes a section of text specified by `ITextRange`
     *
     * @param range `ITextRange` to remove
     */
    public remove(range: ITextRange) {
        this.replace(range, '');
    }

    /**
     * Returns size of text buffer.
     *
     * Very efficient, as the value is returned from up-to-date cache
     */
    public getSize() {
        return this.size;
    }

    /**
     * Returns contents of the buffer, optionally specify `ITextRange` to get a slice
     *
     * If indices are known, it might be performant to get contents without
     * any arguments and then using using `String.prototype.slice` instead.
     * @param range [Optional] `ITextRange` slice/fragment to return
     */
    public getContents(range?: ITextRange) {
        if (range) {
            const start = this.convertPosToZeroBased(range.start);
            const end = this.convertPosToZeroBased(range.end);
            const clampedStart = this.clampTextPosition(start);
            const clampedEnd = this.clampTextPosition(end);
            return [
                this.lines[clampedStart.line].slice(0, clampedStart.col),
                ...this.lines.slice(clampedStart.line + 1, clampedEnd.line),
                this.lines[clampedEnd.line].slice(clampedEnd.col),
            ].join('\n');
        }
        return this.lines.join('\n');
    }

    /**
     * Returns `ITextPosition` from zero-based index
     *
     * When index = 0, `ITextPosition` returned is `{ line: 1, col: 1 }`
     * @param index Zero based index of associated text buffer
     */
    public indexToPosition(index: number): ITextPosition {
        if (index > this.size) {
            throw new RangeError('Index out of range');
        }

        let closestIndex = this.roundToLowerBlockSize(index);

        // try first closest itself then second closest (to avoid intensive binary search)
        let closestCachedIndexToPos = this.indexToPosCache.get(closestIndex);
        if (!closestCachedIndexToPos) {
            const oneBlockShortIndex = closestIndex - DEFAULT_BLOCK_SIZE;
            closestCachedIndexToPos = this.indexToPosCache.get(oneBlockShortIndex);
            if (closestCachedIndexToPos) {
                closestIndex = oneBlockShortIndex;
            }
        }
        // Still not found, fallback to binary search
        if (!closestCachedIndexToPos) {
            const res = this.findHighestCachedIndexToPos(DEFAULT_BLOCK_SIZE, closestIndex) || {
                index: 0,
                pos: { line: 0, col: 0 },
            };

            closestIndex = res.index;
            closestCachedIndexToPos = res.pos;
        }
        const { line, col } = closestCachedIndexToPos;
        const currentLine = 0;

        let lineNumber = line;
        let colNumber = 0;
        const lines = this.lines;
        let steppedCharCount = closestIndex - col;
        while (lineNumber < lines.length) {
            const cLine = lines[lineNumber];
            const newLineCharLen = (currentLine < lines.length ? 1 : 0); // New line char \n
            const charCount = cLine.length + newLineCharLen;
            const steppedCharCountAfterThisCycle = (steppedCharCount + charCount);
            const highestIndexableStop = this.roundToLowerBlockSize(steppedCharCountAfterThisCycle);
            while (closestIndex !== highestIndexableStop) {
                closestIndex += DEFAULT_BLOCK_SIZE;
                if (!this.indexToPosCache.get(closestIndex)) {
                    this.indexToPosCache.set(closestIndex, { line: lineNumber, col: closestIndex - steppedCharCount });
                }
            }

            this.lineToIndexCache.set(lineNumber, steppedCharCount + newLineCharLen);
            if (steppedCharCountAfterThisCycle > index) {
                colNumber = index - steppedCharCount;
                break;
            }
            steppedCharCount += charCount;
            lineNumber++;
        }

        return {
            // Internally data is 0 index based
            col: colNumber + 1,
            line: lineNumber + 1,
        };
    }

    /**
     * Returns zero based index of the associated text buffer from `ITextPosition`
     *
     * @param pos `ITextPosition`, min value: `{ line: 1, col: 1 }`
     */
    public positionToIndex(pos: ITextPosition) {
        const zeroBasedPos = this.convertPosToZeroBased(pos);
        this.checkTextPosition(zeroBasedPos);
        return this.zeroBasedPosToIndex(zeroBasedPos);
    }

    private zeroBasedPosToIndex(zeroBasedPos: ITextPosition) {
        let closestLineNum = zeroBasedPos.line;
        let closestCachedLineToIdx = this.lineToIndexCache.get(closestLineNum);
        // Before falling back to binary search, lets try one last time :|
        if (!closestCachedLineToIdx) {
            closestCachedLineToIdx = this.lineToIndexCache.get(closestLineNum - 1);
            if (closestCachedLineToIdx) {
                closestLineNum--;
            }
        }
        // Well, binary search it is then
        if (!closestCachedLineToIdx) {
            const res = this.findHighestCachedLineToIndex(0, closestLineNum) || {
                index: 0,
                line: 0,
            };

            closestLineNum = res.line;
            closestCachedLineToIdx = res.index;
        }

        const { line, col } = zeroBasedPos;
        const lines = this.lines;
        let currentLine = closestLineNum;
        let offset = closestCachedLineToIdx - 1;
        const cont = currentLine <= line;
        while (cont) {
            const newLineCharLen = (currentLine < lines.length ? 1 : 0); // New line char \n
            this.lineToIndexCache.set(currentLine, offset + newLineCharLen);
            if (currentLine === line) {
                break;
            }
            offset += lines[currentLine].length + newLineCharLen;
            currentLine++;
        }
        offset += col;
        return offset;
    }

    private convertPosToZeroBased(pos: ITextPosition) {
        return {
            col: pos.col - 1,
            line: pos.line - 1,
        };
    }

    private checkTextPosition(pos: ITextPosition) {
        if (pos.line > this.lines.length || pos.col > this.lines[pos.line].length) {
            throw new RangeError('TextPosition out of range');
        }
        if (pos.col < 0 || pos.line < 0) {
            throw new RangeError(`TextPosition is not zero-index based. It starts at {line: 1, col: 1}`);
        }
    }

    private clampTextPosition(pos: ITextPosition) {
        const clampedLine = clamp(pos.line, 1, this.lines.length);
        return {
            col: clamp(pos.col, 1, this.lines[clampedLine].length),
            line: clampedLine,
        } as ITextPosition;
    }

    /**
     * Purges cache following a position
     * @param from Zero based TextPosition
     */
    private flushCache(from: ITextPosition) {
        const idx = this.zeroBasedPosToIndex(from);
        this.lineToIndexCache.flush(from.line);
        this.indexToPosCache.flush(this.roundToLowerBlockSize(idx));
    }

    private roundToLowerBlockSize(index: number) {
        return Math.floor(index / DEFAULT_BLOCK_SIZE) * DEFAULT_BLOCK_SIZE;
    }

    /**
     * Binary kinda search to find highest cached index to pos record between a range
     * @param start
     * @param end
     */
    private findHighestCachedIndexToPos(start: number, end: number): { index: number, pos: ITextPosition } {
        let middleIdx = ((end - start) / 2) + start;
        if (middleIdx % DEFAULT_BLOCK_SIZE !== 0) {
            middleIdx = this.roundToLowerBlockSize(middleIdx);
        }
        if (middleIdx < DEFAULT_BLOCK_SIZE) {
            return;
        }
        const ret = this.indexToPosCache.get(middleIdx);
        if (ret) {
            // If we haven't hit the dead end yet (middle), try looking higher up in the index
            return (start !== middleIdx && end !== middleIdx) ?
                this.findHighestCachedIndexToPos(middleIdx, end) :
                // otherwise this is the best we'll get
                { index: middleIdx, pos: ret };
        } else if (start !== middleIdx) { // Still haven't hit dead end yet
            // If there's nothing at this node, lower the standards and look down in the index.
            return this.findHighestCachedIndexToPos(start, middleIdx);
        }
    }

    /**
     * Binary kinda search to find highest cached index to pos record between a range
     * @param start
     * @param end
     */
    private findHighestCachedLineToIndex(start: number, end: number): { line: number, index: number } {
        let diff = end - start;
        const middleIdx = ((diff % 2 !== 0 ? diff++ : diff) / 2) + start;
        if (middleIdx < 0) {
            return;
        }
        const ret = this.lineToIndexCache.get(middleIdx);
        if (ret) {
            // If we haven't hit the dead end yet (middle), try looking higher up in the index
            return (start !== middleIdx && end !== middleIdx) ?
                this.findHighestCachedLineToIndex(middleIdx, end) :
                // otherwise this is the best we'll get
                { line: middleIdx, index: ret };
        } else if (start !== middleIdx) {
            // If there's nothing at this node, lower the standards and look down in the index.
            return this.findHighestCachedLineToIndex(start, middleIdx);
        }
    }
}

export interface ITextPosition {
    line: number;
    col: number;
}

export interface ITextRange {
    start: ITextPosition;
    end: ITextPosition;
}

class SCache<T> {
    private arr: T[];
    constructor() {
        this.arr = [];
    }
    public get(idx: number) {
        return this.arr[(idx / DEFAULT_BLOCK_SIZE)];
    }
    public set(idx: number, value: T) {
        this.arr[(idx / DEFAULT_BLOCK_SIZE)] = value;
    }
    public flush(from: number) {
        this.arr = this.arr.slice(0, (from / DEFAULT_BLOCK_SIZE));
    }
}

class VCache<T> {
    private arr: T[];
    constructor() {
        this.arr = [];
    }
    public get(idx: number) {
        return this.arr[idx];
    }
    public set(idx: number, value: T) {
        this.arr[idx] = value;
    }
    public flush(from: number) {
        this.arr = this.arr.slice(0, from);
    }
}

export default TextStore;
