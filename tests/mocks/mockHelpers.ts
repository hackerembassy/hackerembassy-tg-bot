import nock from "nock";
import TelegramBot from "node-telegram-bot-api";

import { addRoutes, startRouting } from "../../bot/init/router";
import { HackerEmbassyBotMock } from "./HackerEmbassyBotMock";

export const ADMIN_USER_NAME = "adminusername";
export const GUEST_USER_NAME = "guestusername";

export function mockTelegramApiRequests() {
    nock("https://api.telegram.org")
        .post("/botTOKEN/getUpdates", "offset=0&timeout=10")
        .reply(200, {
            ok: true,
            result: [],
        })
        .persist();

    nock("https://api.telegram.org")
        .post("/botTOKEN/sendChatAction", "chat_id=1&action=typing")
        .reply(200, {
            ok: true,
            result: [],
        })
        .persist();
}

export async function prepareDb() {
    const usersRepository = (await import("../../repositories/usersRepository")).default;
    usersRepository.addUser(ADMIN_USER_NAME, ["admin|member|accountant"], 123);
}

export function createBotMock() {
    mockTelegramApiRequests();
    const botMock = new HackerEmbassyBotMock("TOKEN", {});
    addRoutes(botMock);
    startRouting(botMock, false);

    return botMock;
}

export function createMockMessage(
    text: string,
    fromUsername: string = GUEST_USER_NAME,
    timestamp: number = Date.now()
): TelegramBot.Update {
    return {
        update_id: 0,
        message: {
            message_id: 1,
            from: {
                id: 1,
                is_bot: false,
                first_name: "First Name",
                username: fromUsername,
                language_code: "ru-RU",
            },
            chat: {
                id: 1,
                first_name: "First Name",
                username: fromUsername,
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
