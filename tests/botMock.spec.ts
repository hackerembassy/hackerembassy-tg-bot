import config from "config";
import nock from "nock";
import { ChatId, Message, SendMessageOptions } from "node-telegram-bot-api";

jest.mock("../utils/currency", () => {
    return {
        default: jest.fn(),
    };
});

import { setRoutes } from "../bot/bot-routes";
import HackerEmbassyBot from "../bot/HackerEmbassyBot";

class HackerEmbassyBotMock extends HackerEmbassyBot {
    constructor(token: string, options: any) {
        super(token, options);
    }

    override sendMessage(chatId: ChatId, text: string, options: SendMessageOptions): Promise<Message> {
        console.log(`Sending message to chat ${chatId}: ${text} with ${options}`);
        // @ts-ignore
        return Promise.resolve(null);
    }
}

// nock.disableNetConnect();
nock("https://api.telegram.org").post("/botTOKEN/getUpdates", "offset=0&timeout=10").reply(200, {
    ok: true,
    result: [],
});

const botMock = new HackerEmbassyBotMock("TOKEN", {});

setRoutes(botMock);

const message = {
    update_id: 0,
    message: {
        message_id: 207,
        from: {
            id: 24529653,
            is_bot: false,
            first_name: "B",
            username: "userA",
            language_code: "en-CH",
        },
        chat: {
            id: 24529653,
            first_name: "A",
            username: "userA",
            type: "private",
        },
        date: 1508417092,
        text: "/start",
        entities: [
            {
                offset: 0,
                length: 5,
                type: "bot_command",
            },
        ],
    },
};

describe("HackerEmbassyBotMock", () => {
    test("should send message to chat", async () => {
        console.log(config);

        botMock.processUpdate(message as any);
    });
});
