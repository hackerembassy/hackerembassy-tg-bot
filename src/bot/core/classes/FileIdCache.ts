export const DEFAULT_FILE_ID_CACHE_SIZE = 5000;

// Maps media keys (content hashes, custom keys) to Telegram file_ids.
// Bounded LRU: Map keeps insertion order, so the first key is always the least recently used.
export default class FileIdCache {
    private readonly entries: Map<string, string>;

    constructor(
        initial: Record<string, string> = {},
        private readonly maxSize = DEFAULT_FILE_ID_CACHE_SIZE,
        private readonly onChange: () => void = () => {}
    ) {
        this.entries = new Map(Object.entries(initial));
        this.evict();
    }

    get size(): number {
        return this.entries.size;
    }

    get(key: string): Optional<string> {
        const fileId = this.entries.get(key);

        if (fileId !== undefined) {
            this.entries.delete(key);
            this.entries.set(key, fileId);
        }

        return fileId;
    }

    // replacePrefix drops older entries of the same family, e.g. previous donuts of one fund
    set(key: string, fileId: string, replacePrefix?: string): void {
        if (replacePrefix) {
            for (const existingKey of this.entries.keys()) {
                if (existingKey.startsWith(replacePrefix)) this.entries.delete(existingKey);
            }
        }

        this.entries.delete(key);
        this.entries.set(key, fileId);
        this.evict();
        this.onChange();
    }

    delete(key: string): void {
        if (this.entries.delete(key)) this.onChange();
    }

    clear(): void {
        this.entries.clear();
    }

    toJSON(): Record<string, string> {
        return Object.fromEntries(this.entries);
    }

    private evict(): void {
        for (const oldestKey of this.entries.keys()) {
            if (this.entries.size <= this.maxSize) break;
            this.entries.delete(oldestKey);
        }
    }
}
