/* eslint-disable @typescript-eslint/no-unused-vars */
import { Stream } from "stream";

import TelegramBot, { ChatId, Message, SendMessageOptions, SendPhotoOptions } from "node-telegram-bot-api";

import HackerEmbassyBot from "@hackembot/core/HackerEmbassyBot";

import { sleep } from "@utils/common";

export class HackerEmbassyBotMock extends HackerEmbassyBot {
    constructor(token: string, options: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        super(token, options);
        this.Name = "HackerEmbassyBotMock";
    }

    private results: string[] = [];

    override async sendMessage(chatId: ChatId, text: string, options: SendMessageOptions): Promise<Message> {
        this.results.push(text);
        await sleep(0);
        // @ts-ignore
        return Promise.resolve({ message_id: 1 });
    }

    override async sendPhoto(
        chatId: TelegramBot.ChatId,
        photo: string | Stream | Buffer,
        options: SendPhotoOptions,
        fileOptions = {}
    ): Promise<Message> {
        this.results.push(options.caption ?? "");
        await sleep(0);
        // @ts-ignore
        return Promise.resolve({ message_id: 1 });
    }

    async processUpdate(update: TelegramBot.Update) {
        super.processUpdate(update);
        await sleep(10); // Simulating async processing and clearing microtasks
    }

    public popResults(): string[] {
        const results = this.results;
        this.results = [];

        return results;
    }
}
