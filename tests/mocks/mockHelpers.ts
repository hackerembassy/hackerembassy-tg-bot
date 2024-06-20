import nock from "nock";
import TelegramBot from "node-telegram-bot-api";

import { addRoutes, startRouting } from "@hackembot/router";

import { GUEST_USER } from "../dbSetup";
import { HackerEmbassyBotMock } from "./HackerEmbassyBotMock";

export function mockTelegramApiRequests() {
    nock("https://api.telegram.org")
        .post("/botTOKEN/getUpdates", "offset=0&timeout=10")
        .reply(200, {
            ok: true,
            result: [],
        })
        .persist();

    nock("https://api.telegram.org")
        .post("/botTOKEN/sendChatAction")
        .reply(200, {
            ok: true,
            result: [],
        })
        .persist();
}

export function createMockBot() {
    mockTelegramApiRequests();
    const botMock = new HackerEmbassyBotMock("TOKEN", {});
    addRoutes(botMock);
    startRouting(botMock, false);

    return botMock;
}

export function createMockMessage(text: string, fromUser = GUEST_USER, timestamp: number = Date.now()): TelegramBot.Update {
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
