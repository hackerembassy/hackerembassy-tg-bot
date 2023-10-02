import config from "config";

import { BotConfig } from "../../config/schema";
import BotState from "./BotState";

const botConfig = config.get<BotConfig>("bot");

export type MessageHistoryEntry = {
    messageId: number;
    text?: string;
    datetime: number;
};

export default class MessageHistory {
    botState: BotState;

    constructor(botState: BotState) {
        this.botState = botState;
    }

    orderOf(chatId: number, messageId: number): Optional<number> {
        return this.botState.history[chatId]?.findIndex(x => x.messageId === messageId);
    }

    async push(chatId: string | number, messageId: number, text: string | undefined = undefined, order = 0): Promise<void> {
        if (!this.botState.history[chatId]) this.botState.history[chatId] = [];

        const chatHistory = this.botState.history[chatId] as MessageHistoryEntry[];

        if (chatHistory.length >= botConfig.maxchathistory) chatHistory.pop();

        chatHistory.splice(order, 0, { messageId, text, datetime: Date.now() });

        await this.botState.persistChanges();
    }

    pop(chatId: number, from: number = 0): Nullable<MessageHistoryEntry> {
        const chatHistory = this.botState.history[chatId] as MessageHistoryEntry[] | undefined;

        if (!chatHistory || chatHistory.length === 0) return null;

        const removed = chatHistory.splice(from, 1)[0];
        this.botState.debouncedPersistChanges();

        return removed;
    }

    // TODO update history entry for EditMessage
}
