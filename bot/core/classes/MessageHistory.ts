import BotState from "./BotState";
import { MessageHistoryEntry } from "../types";

type ChatMessageLog = { [chatId: string]: Optional<MessageHistoryEntry[]> };

export default class MessageHistory {
    botState: BotState;
    messageLog: ChatMessageLog;
    limit: number;

    constructor(botState: BotState, messageLog: ChatMessageLog, limit: number) {
        this.botState = botState;
        this.messageLog = messageLog;
        this.limit = limit;
    }

    orderOf(chatId: number, messageId: number): Optional<number> {
        return this.messageLog[chatId]?.findIndex(x => x.messageId === messageId);
    }

    async push(chatId: string | number, entry: Omit<MessageHistoryEntry, "datetime">, order = 0): Promise<void> {
        if (!this.messageLog[chatId]) this.messageLog[chatId] = [];

        const chatHistory = this.messageLog[chatId];

        if (chatHistory.length >= this.limit) chatHistory.pop();

        const fullEntry: MessageHistoryEntry = {
            ...entry,
            datetime: Date.now(),
        };

        chatHistory.splice(order, 0, fullEntry);

        await this.botState.persistChanges();
    }

    pop(chatId: number, from: number = 0): Nullable<MessageHistoryEntry> {
        const chatHistory = this.messageLog[chatId];

        if (!chatHistory || chatHistory.length === 0) return null;

        const removed = chatHistory.splice(from, 1)[0];
        this.botState.debouncedPersistChanges();

        return removed;
    }

    get(chatId: number, from: number = 0): Nullable<MessageHistoryEntry> {
        return this.messageLog[chatId]?.[from] ?? null;
    }

    getAll(chatId: number): MessageHistoryEntry[] {
        return this.messageLog[chatId] ?? [];
    }

    // TODO update history entry for EditMessage
}
