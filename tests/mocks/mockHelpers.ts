import fs from "fs";
import nock from "nock";

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
