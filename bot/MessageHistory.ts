import config from "config";

import { BotConfig } from "../config/schema";
import BotState from "./BotState";

const botConfig = config.get("bot") as BotConfig;

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

    orderOf(chatId: number, messageId: number): number {
        return this.botState.history[chatId].findIndex(x => x.messageId === messageId);
    }

    async push(chatId: string | number, messageId: number, text: string | undefined = undefined, order = 0): Promise<void> {
        if (!this.botState.history[chatId]) this.botState.history[chatId] = [];
        if (this.botState.history[chatId].length >= botConfig.maxchathistory) this.botState.history[chatId].pop();

        this.botState.history[chatId].splice(order, 0, { messageId, text, datetime: Date.now() });

        await this.botState.persistChanges();
    }

    async pop(chatId: number, from: number = 0): Promise<MessageHistoryEntry | null> {
        if (!this.botState.history[chatId] || this.botState.history[chatId].length === 0) return null;

        const removed = this.botState.history[chatId].splice(from, 1)[0];
        this.botState.debouncedPersistChanges();

        return removed;
    }

    // TODO update history entry for EditMessage
}
