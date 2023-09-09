import Database from "better-sqlite3";
import fs from "fs";

import { HackerEmbassyBotMock } from "./mocks/HackerEmbassyBotMock";
import { cleanDb, createBotMock, prepareDb } from "./mocks/mockHelpers";

jest.mock("../utils/currency", () => {
    return {
        default: jest.fn(),
    };
});

jest.mock("../utils/network", () => {
    return {
        default: jest.fn(),
        fetchWithTimeout: jest.fn(),
    };
});

fs.copyFileSync("./data/sample.db", "./data/test.db");

jest.mock("../data/db", () => {
    return new Database("./data/test.db");
});

function createMockMessage(text: string) {
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

describe("HackerEmbassyBotMock", () => {
    const botMock: HackerEmbassyBotMock = createBotMock();

    beforeAll(() => {
        prepareDb();
    });

    test("should send message to chat", async () => {
        botMock?.processUpdate(createMockMessage("/open") as any);
        botMock?.processUpdate(createMockMessage("/inforce user1") as any);
        botMock?.processUpdate(createMockMessage("/inforce user2") as any);
        botMock?.processUpdate(createMockMessage("/inforce user3") as any);
        botMock?.processUpdate(createMockMessage("/close") as any);
        botMock?.processUpdate(createMockMessage("/status") as any);

        await jest.runAllTimersAsync();

        expect(botMock?.getResults()).toEqual(["basic\\.start\\.text"]);
    });

    afterAll(() => {
        cleanDb();
    });
});
