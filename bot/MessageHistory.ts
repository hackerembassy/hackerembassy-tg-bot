import config from "config";
import { existsSync, mkdirSync, promises, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

import { BotConfig } from "../config/schema";
import { debounce } from "../utils/common";

const botConfig = config.get("bot") as BotConfig;

export type MessageHistoryEntry = {
    messageId: number;
    text?: string;
    datetime: number;
};

export default class MessageHistory {
    historypath: string;

    constructor() {
        this.historypath = join(botConfig.persistedfolderpath, "history.json");

        if (existsSync(this.historypath)) {
            this.#historyBuffer = JSON.parse(readFileSync(this.historypath).toString());
        } else {
            this.#historyBuffer = {};
            mkdirSync(dirname(this.historypath), { recursive: true });
            writeFileSync(this.historypath, JSON.stringify(this.#historyBuffer));
        }
    }

    orderOf(chatId: number, messageId: number): number {
        return this.#historyBuffer[chatId].findIndex(x => x.messageId === messageId);
    }

    async push(chatId: string | number, messageId: number, text: string | undefined = undefined, order = 0): Promise<void> {
        if (!this.#historyBuffer[chatId]) this.#historyBuffer[chatId] = [];
        if (this.#historyBuffer[chatId].length >= botConfig.maxchathistory) this.#historyBuffer[chatId].pop();

        this.#historyBuffer[chatId].splice(order, 0, { messageId, text, datetime: Date.now() });

        await this.#persistChanges();
    }

    async pop(chatId: number, from: number = 0): Promise<MessageHistoryEntry | null> {
        if (!this.#historyBuffer[chatId] || this.#historyBuffer[chatId].length === 0) return null;

        const removed = this.#historyBuffer[chatId].splice(from, 1)[0];
        this.#debouncedPersistChanges();

        return removed;
    }

    #historyBuffer: { [chatId: string]: MessageHistoryEntry[] };

    #debouncedPersistChanges = debounce(async () => {
        await this.#persistChanges();
    }, 1000);

    async #persistChanges(): Promise<void> {
        await promises.writeFile(this.historypath, JSON.stringify(this.#historyBuffer));
    }

    // TODO update history entry for EditMessage
}
