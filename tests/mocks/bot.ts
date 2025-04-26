/* eslint-disable @typescript-eslint/no-unused-vars */
import { Stream } from "stream";

import TelegramBot, { ChatId, Message, SendMessageOptions, SendPhotoOptions } from "node-telegram-bot-api";

import { addControllers } from "@hackembot/router";
import { TEST_USERS } from "@data/seed";
import HackerEmbassyBot from "@hackembot/core/HackerEmbassyBot";
import { sleep } from "@utils/common";

export class HackerEmbassyBotMock extends HackerEmbassyBot {
    constructor(token: string) {
        super(token);
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
        await sleep(100); // Simulating async processing and clearing microtasks
    }

    public popResults(): string[] {
        const results = this.results;
        this.results = [];

        return results;
    }
}

export function createMockBot() {
    const botMock = new HackerEmbassyBotMock("TOKEN");
    addControllers(botMock);
    botMock.start();

    return botMock;
}

export function createMockMessage(text: string, fromUser = TEST_USERS.guest, timestamp: number = Date.now()): TelegramBot.Update {
    return {
        update_id: 0,
        message: {
            message_id: 1,
            from: {
                id: fromUser.userid,
                is_bot: false,
                first_name: "First Name",
                username: fromUser.username,
                language_code: "ru-RU",
            },
            chat: {
                id: fromUser.userid,
                first_name: "First Name",
                username: fromUser.username,
                type: "private",
            },
            date: timestamp / 1000,
            text,
            entities: [
                {
                    offset: 0,
                    length: text.length,
                    type: "bot_command",
                },
            ],
        },
    };
}
