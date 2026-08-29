import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

import logger from "@services/common/logger";
import { debounce } from "@utils/common";
import { readJsonFile, writeJsonFileAtomic } from "@utils/filesystem";

import { MessageHistoryEntry } from "../types";

export type ChatMessageLog = { [chatId: string]: Optional<MessageHistoryEntry[]> };

export interface MessageLogStore {
    loadAll(): ChatMessageLog;
    persist(chatId: string | number, entries: MessageHistoryEntry[]): void;
    clearAll(): void;
}

/**
 * Persists one JSON file per chat under `dir`, so a write for one chat never touches another
 * chat's data and a crash mid-write can't corrupt more than that one chat's log.
 */
export class FileMessageLogStore implements MessageLogStore {
    // One debounced writer per chat, created lazily, so a write for one chat never resets
    // another chat's pending timer the way a single shared debounce() call would.
    private readonly debouncedWriters = new Map<string, ReturnType<typeof debounce>>();

    constructor(
        private readonly dir: string,
        private readonly debounceMs = 1000
    ) {}

    private filePath(chatId: string | number): string {
        return path.join(this.dir, `${chatId}.json`);
    }

    loadAll(): ChatMessageLog {
        const log: ChatMessageLog = {};

        if (!existsSync(this.dir)) return log;

        for (const file of readdirSync(this.dir)) {
            if (!file.endsWith(".json")) continue;

            const chatId = file.slice(0, -".json".length);
            const entries = readJsonFile<MessageHistoryEntry[]>(path.join(this.dir, file));

            if (entries) log[chatId] = entries;
        }

        return log;
    }

    persist(chatId: string | number, entries: MessageHistoryEntry[]): void {
        const key = String(chatId);
        let writer = this.debouncedWriters.get(key);

        if (!writer) {
            // `entries` is the same live array reused across calls for this chatId (MessageHistory
            // mutates it in place), so this closure always sees the latest content when it fires.
            writer = debounce(() => {
                void writeJsonFileAtomic(this.filePath(chatId), entries).catch(error => {
                    logger.error(`Failed to persist message log for chat ${key}`);
                    logger.error(error);
                });
            }, this.debounceMs);
            this.debouncedWriters.set(key, writer);
        }

        writer();
    }

    clearAll(): void {
        for (const writer of this.debouncedWriters.values()) writer.cancel();
        this.debouncedWriters.clear();

        if (!existsSync(this.dir)) return;

        for (const file of readdirSync(this.dir)) {
            if (file.endsWith(".json")) rmSync(path.join(this.dir, file));
        }
    }
}
