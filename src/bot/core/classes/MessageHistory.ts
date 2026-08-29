import { ChatMessageLog, MessageLogStore } from "./MessageLogStore";
import { MessageHistoryEntry } from "../types";

export default class MessageHistory {
    store: MessageLogStore;
    messageLog: ChatMessageLog;
    limit: number;

    constructor(store: MessageLogStore, limit: number) {
        this.store = store;
        this.limit = limit;
        this.messageLog = store.loadAll();
    }

    orderOf(chatId: number, messageId: number): Optional<number> {
        return this.messageLog[chatId]?.findIndex(x => x.messageId === messageId);
    }

    push(chatId: string | number, entry: Omit<MessageHistoryEntry, "datetime">, order = 0) {
        if (!this.messageLog[chatId]) this.messageLog[chatId] = [];

        const chatHistory = this.messageLog[chatId];

        if (chatHistory.length >= this.limit) chatHistory.pop();

        const fullEntry: MessageHistoryEntry = {
            ...entry,
            datetime: Date.now(),
        };

        chatHistory.splice(order, 0, fullEntry);

        this.store.persist(chatId, chatHistory);
    }

    pop(chatId: number, from: number = 0): Nullable<MessageHistoryEntry> {
        const chatHistory = this.messageLog[chatId];

        if (!chatHistory || chatHistory.length === 0) return null;

        const removed = chatHistory.splice(from, 1)[0];
        this.store.persist(chatId, chatHistory);

        return removed;
    }

    get(chatId: number, from: number = 0): Nullable<MessageHistoryEntry> {
        return this.messageLog[chatId]?.[from] ?? null;
    }

    getAll(chatId: number): MessageHistoryEntry[] {
        return this.messageLog[chatId] ?? [];
    }

    clearAll() {
        this.messageLog = {};
        this.store.clearAll();
    }

    // TODO update history entry for EditMessage
}
