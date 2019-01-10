import TextStore, { ITextPosition, ITextRange, TextStoreChange, TextStoreEvent } from './TextStore'

class Node {
    private from: number
    private to: number
    private cachedValue: string
    private children: Node[]
}

class CachedToString {
    private rootNode: Node
    constructor(private store: TextStore, private lines: ReadonlyArray<string>) {
        store.onDidChange(this.flush)
    }

    public getStringValue(start: ITextPosition, end: ITextPosition) {
        //
    }

    private flush(event: TextStoreEvent, info: TextStoreChange) {
        //
    }
}
