import fs from "fs";
import nock from "nock";
import TelegramBot from "node-telegram-bot-api";

import { setRoutes } from "../../bot/bot-routes";
import { HackerEmbassyBotMock } from "./HackerEmbassyBotMock";

export function mockTelegramApiRequests() {
    // nock.disableNetConnect();
    nock("https://api.telegram.org").post("/botTOKEN/getUpdates", "offset=0&timeout=10").reply(200, {
        ok: true,
        result: [],
    });

    nock("https://api.telegram.org").post("/botTOKEN/sendChatAction", "chat_id=1&action=typing").reply(200, {
        ok: true,
        result: [],
    });
}

export function cleanDb() {
    fs.unlinkSync("./data/test.db");
}

export async function prepareDb() {
    const usersRepository = (await import("../../repositories/usersRepository")).default;

    usersRepository.addUser("adminusername", ["admin"]);
}

export function createBotMock() {
    mockTelegramApiRequests();

    const botMock = new HackerEmbassyBotMock("TOKEN", {});
    setRoutes(botMock);

    return botMock;
}

export function createMockMessage(text: string): TelegramBot.Update {
    return {
        update_id: 0,
        message: {
            message_id: 207,
            from: {
                id: 1,
                is_bot: false,
                first_name: "First Name",
                username: "adminusername",
                language_code: "ru-RU",
            },
            chat: {
                id: 1,
                first_name: "First Name",
                username: "adminusername",
                type: "private",
            },
            date: 1508417092,
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
