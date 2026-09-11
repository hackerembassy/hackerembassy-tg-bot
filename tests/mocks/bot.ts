/* eslint-disable @typescript-eslint/no-unused-vars */
import { Stream } from "node:stream";

import { CallbackQuery, ChatId, EditMessageTextParams, EditMessageTextResult, Message, Update } from "node-telegram-bot-api";

import { addControllers } from "@hackembot/setup";
import { TEST_USERS } from "@data/seed";
import HackerEmbassyBot from "@hackembot/core/classes/HackerEmbassyBot";
import { ButtonFlags } from "@hackembot/core/inlineButtons";
import { CallbackData, FileInput, SendAnimationOptions, SendMessageOptions, SendPhotoOptions } from "@hackembot/core/types";

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

    // HackerEmbassyBot only ever calls the (text, form) overload (via editMessageTextExt); the
    // (form) single-object overload is accepted here purely so the override stays assignable to
    // the base class's full overload set. Real Telegram behavior for a normal chat edit (as
    // opposed to an inline-query message, which this bot never edits) is the edited Message, not
    // `true` - callers like status.ts read resultMessage.message_id/.chat back out afterwards.
    override editMessageText(
        textOrForm: string | EditMessageTextParams,
        form?: Omit<EditMessageTextParams, "text">
    ): Promise<EditMessageTextResult> {
        const text = typeof textOrForm === "string" ? textOrForm : (textOrForm.text ?? "");
        const { chat_id, message_id } = typeof textOrForm === "string" ? (form ?? {}) : textOrForm;
        this.results.push(text);

        return Promise.resolve({
            message_id: message_id ?? 1,
            date: 0,
            chat: { id: Number(chat_id ?? 0), type: "private" },
            text,
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

    override async routeCallback(callbackQuery: CallbackQuery) {
        const routingPromise = super.routeCallback(callbackQuery);
        this.pendingRoutings.add(routingPromise);

        try {
            return await routingPromise;
        } finally {
            this.pendingRoutings.delete(routingPromise);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async processUpdate(update: Update) {
        // routeMessage/routeCallback are invoked fire-and-forget from event listeners, so capture
        // the promise(s) they add to pendingRoutings during this call and await those.
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

export function createMockMessage(
    text: string,
    fromUser = TEST_USERS.guest,
    timestamp: number = Date.now(),
    chatId: number = fromUser.userid
): Update {
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
                id: chatId,
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

// Simulates pressing an inline button built with InlineButton(text, cmd, flags, { params }) -
// routeCallback requires callback_query.message.from to already be set (it's used as the
// throttle key before callbackHandler overwrites msg.from with the presser's identity).
export function createMockCallbackQuery(
    cmd: string,
    fromUser = TEST_USERS.guest,
    options: { flags?: ButtonFlags; params?: unknown; chatId?: number; messageId?: number } = {}
): Update {
    const chatId = options.chatId ?? fromUser.userid;
    const messageId = options.messageId ?? 1;
    const data: CallbackData = { cmd, fs: options.flags, ...(options.params === undefined ? {} : { params: options.params }) };

    return {
        update_id: 0,
        callback_query: {
            id: "1",
            chat_instance: "1",
            from: {
                id: fromUser.userid,
                is_bot: false,
                first_name: "First Name",
                username: fromUser.username,
            },
            message: {
                message_id: messageId,
                chat: { id: chatId, type: "private" },
                date: Date.now() / 1000,
                from: {
                    id: fromUser.userid,
                    is_bot: false,
                    first_name: "First Name",
                    username: fromUser.username,
                },
            },
            data: JSON.stringify(data),
        },
    };
}
