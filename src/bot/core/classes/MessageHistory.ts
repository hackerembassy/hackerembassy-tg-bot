import { Message } from "node-telegram-bot-api";

import { effectiveName } from "../helpers";
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

    findByMessageId(chatId: number, messageId: number): Nullable<MessageHistoryEntry> {
        return this.messageLog[chatId]?.find(x => x.messageId === messageId) ?? null;
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

    // Telegram only gives the immediate parent of a reply (msg.reply_to_message), never its own
    // ancestors, so going further back means walking this store's replyToMessageId links.
    getReplyChainPrompt(msg: Message, maxDepth: number = Infinity): Optional<string> {
        const lines: string[] = [];
        let parentId = msg.reply_to_message?.message_id;
        let parentMessage = msg.reply_to_message;

        while (parentId && lines.length < maxDepth) {
            const entry = this.findByMessageId(msg.chat.id, parentId);
            const text = entry?.text ?? parentMessage?.text ?? parentMessage?.caption;
            const from = entry?.from ?? (parentMessage?.from ? effectiveName(parentMessage.from) : undefined);

            if (!text) break;

            lines.unshift(from ? `${from}: ${text}` : text);
            parentId = entry?.replyToMessageId;
            parentMessage = undefined; // only the first hop has a Telegram-provided fallback
        }

        return lines.length > 0 ? lines.join("\n") : undefined;
    }

    // TODO update history entry for EditMessage
}
