/* eslint-disable @typescript-eslint/no-unused-vars */
import { Stream } from "node:stream";

import { ChatId, Message, Update } from "node-telegram-bot-api";

import { addControllers } from "@hackembot/setup";
import { TEST_USERS } from "@data/seed";
import HackerEmbassyBot from "@hackembot/core/classes/HackerEmbassyBot";
import { sleep } from "@utils/common";
import { SendMessageOptions, SendPhotoOptions } from "@hackembot/core/types";

export class HackerEmbassyBotMock extends HackerEmbassyBot {
    constructor(token: string) {
        super(token);
    }

    private results: string[] = [];

    override async sendMessage(chatId: ChatId, text: string, options: SendMessageOptions): Promise<Message> {
        this.results.push(text);
        await sleep(0);
        return { message_id: 1, date: 0, chat: { id: chatId, type: "private" }, text } as Message;
    }

    override async sendPhoto(
        chatId: number,
        photo: string | Stream | Buffer,
        options: SendPhotoOptions,
        fileOptions = {}
    ): Promise<Message> {
        this.results.push(options.caption ?? "");
        await sleep(0);
        return {
            message_id: 1,
            date: 0,
            chat: { id: chatId, type: "private" },
            caption: options.caption,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async processUpdate(update: Update) {
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

export function createMockMessage(text: string, fromUser = TEST_USERS.guest, timestamp: number = Date.now()): Update {
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
