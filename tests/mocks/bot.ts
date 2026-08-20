/* eslint-disable @typescript-eslint/no-unused-vars */
import { Stream } from "node:stream";

import { ChatId, Message, Update } from "node-telegram-bot-api";

import { addControllers } from "@hackembot/setup";
import { TEST_USERS } from "@data/seed";
import HackerEmbassyBot from "@hackembot/core/classes/HackerEmbassyBot";
import { FileInput, SendAnimationOptions, SendMessageOptions, SendPhotoOptions } from "@hackembot/core/types";

export class HackerEmbassyBotMock extends HackerEmbassyBot {
    constructor(token: string) {
        super(token);
    }

    private results: string[] = [];
    private pendingRoutings = new Set<Promise<unknown>>();

    override sendMessage(chatId: ChatId, text: string, options: SendMessageOptions): Promise<Message> {
        this.results.push(text);
        return Promise.resolve({ message_id: 1, date: 0, chat: { id: chatId, type: "private" }, text } as Message);
    }

    override sendPhoto(
        chatId: number,
        photo: string | Stream | Buffer,
        options: SendPhotoOptions,
        fileOptions = {}
    ): Promise<Message> {
        this.results.push(options.caption ?? "");
        return Promise.resolve({
            message_id: 1,
            date: 0,
            chat: { id: chatId, type: "private" },
            caption: options.caption,
        } as Message);
    }

    override sendAnimation(chatId: ChatId, animation: FileInput, options?: SendAnimationOptions): Promise<Message> {
        this.results.push(options?.caption ?? "");
        return Promise.resolve({
            message_id: 1,
            date: 0,
            chat: { id: chatId, type: "private" },
            caption: options?.caption,
        } as Message);
    }

    override async routeMessage(message: Message) {
        const routingPromise = super.routeMessage(message);
        this.pendingRoutings.add(routingPromise);

        try {
            return await routingPromise;
        } finally {
            this.pendingRoutings.delete(routingPromise);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async processUpdate(update: Update) {
        // routeMessage is invoked fire-and-forget from an event listener, so capture
        // the promise(s) it adds to pendingRoutings during this call and await those.
        const routingsBefore = new Set(this.pendingRoutings);
        super.processUpdate(update);
        const newRoutings = [...this.pendingRoutings].filter(promise => !routingsBefore.has(promise));

        await Promise.all(newRoutings);
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

    afterAll(() => botMock.stopPolling({ cancel: true }));

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
