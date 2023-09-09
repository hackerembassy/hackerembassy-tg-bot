import Database from "better-sqlite3";
import fs from "fs";

import { sleep } from "../utils/common";
import { HackerEmbassyBotMock } from "./mocks/HackerEmbassyBotMock";
import { cleanDb, createBotMock, createMockMessage, prepareDb } from "./mocks/mockHelpers";

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

describe("HackerEmbassyBotMock", () => {
    const botMock: HackerEmbassyBotMock = createBotMock();

    beforeAll(async () => {
        prepareDb();
        await sleep(100);
    });

    test("should send message to chat", async () => {
        await botMock.processUpdate(createMockMessage("/open"));
        await botMock.processUpdate(createMockMessage("/inforce user1"));
        await botMock.processUpdate(createMockMessage("/inforce user2"));
        await botMock.processUpdate(createMockMessage("/inforce user3"));
        await botMock.processUpdate(createMockMessage("/close"));
        await botMock.processUpdate(createMockMessage("/status"));

        await Promise.resolve(process.nextTick);

        const results = botMock.getResults();

        results[results.length - 1] = results[results.length - 1].replace(/\s\d\d.*\n/gm, "");

        expect(results).toEqual([
            "status\\.open",
            "status\\.inforce\\.gotin",
            "status\\.inforce\\.gotin",
            "status\\.inforce\\.gotin",
            "status\\.close",
            "status\\.status\\.state\n" + "status\\.status\\.nooneinside\n" + "\n" + "⏱ status\\.status\\.updated",
        ]);
    });

    afterAll(() => {
        cleanDb();
    });
});
