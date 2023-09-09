import TelegramBot, { ChatId, Message, SendMessageOptions } from "node-telegram-bot-api";

import HackerEmbassyBot from "../../bot/HackerEmbassyBot";
import { sleep } from "../../utils/common";

export class HackerEmbassyBotMock extends HackerEmbassyBot {
    constructor(token: string, options: any) {
        super(token, options);
    }

    private results: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override async sendMessage(chatId: ChatId, text: string, options: SendMessageOptions): Promise<Message> {
        this.results.push(text);
        await sleep(0);
        // @ts-ignore
        return Promise.resolve(null);
    }

    async processUpdate(update: TelegramBot.Update) {
        // Artificially slowing down process update to prevent db update with the same datetime
        await sleep(1);
        super.processUpdate(update);
        return;
    }

    public popResults(): string[] {
        const results = this.results;
        this.results = [];

        return results;
    }
}
