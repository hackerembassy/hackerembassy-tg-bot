/* eslint-disable no-console */
import fetchMock from "jest-fetch-mock";

import { sleep } from "@utils/common";
import { getOrCreateDb, seedUsers } from "@data/scripts";
import { SEED_TEST_USERS } from "@data/seed";

import { createEmbassyMock as mockCreateEmbassyMock } from "./mocks/embassy";
import * as mockBotStateModule from "./mocks/botState";

fetchMock.enableMocks();

fetchMock.mockIf(/^https:\/\/api\.telegram\.org/, req => {
    if (req.url.includes("getUpdates")) {
        return Promise.resolve({
            status: 200,
            body: JSON.stringify({
                ok: true,
                result: [],
            }),
        });
    }

    return Promise.resolve({
        status: 200,
        body: JSON.stringify({
            ok: true,
            result: "{}",
        }),
    });
});

jest.mock("@utils/meta", () => {
    return {
        rootDir: process.cwd(),
        getFilename: jest.fn((metaUrl: string) => metaUrl),
        getDirname: jest.fn((metaUrl: string) => metaUrl),
    };
});

jest.mock("@services/funds/currency", () => {
    return {
        ...jest.requireActual<typeof import("@services/funds/currency")>("@services/funds/currency"),
        convert: jest.fn(),
        initConvert: jest.fn(),
        convertCurrency: jest.fn((amount: number) => amount),
        prepareCurrency: jest.fn((currency: string) => currency),
    };
});

jest.mock("@services/funds/export", () => {
    return {
        ...jest.requireActual<typeof import("@services/funds/export")>("@services/funds/export"),
        getSponsorshipLevel: jest.fn(() => null),
    };
});

jest.mock("@utils/network", () => {
    return {
        default: jest.fn(),
        fetchWithTimeout: jest.fn().mockImplementation(fetchMock),
    };
});

jest.mock("@data/db", () => {
    const testDb = getOrCreateDb(true, ":memory:");

    void seedUsers(SEED_TEST_USERS);

    return testDb;
});

jest.mock("@services/external/googleCalendar", () => ({
    getClosestEventsFromCalendar: jest.fn().mockReturnValue([]),
    getTodayEvents: jest.fn().mockReturnValue([]),
    getTodayEventsCached: jest.fn().mockReturnValue([]),
    getEventsJSON: jest.fn().mockReturnValue([]),
}));

// See tests/mocks/embassy.ts and tests/mocks/botState.ts for why these are mocked.
jest.mock("@services/embassy/embassy", () => mockCreateEmbassyMock());
jest.mock("@hackembot/core/classes/BotState", () => mockBotStateModule);

jest.mock("@services/common/logger", () => {
    return {
        ...jest.requireActual<typeof import("@services/common/logger")>("@services/common/logger"),
        log: jest.fn(),
        error: jest.fn().mockImplementation((error: Error | string) => {
            if (error instanceof Error && !error.message.startsWith("Mocked") && !error.message.startsWith("request to")) {
                console.log(error.message);
            }
        }),
        info: jest.fn(),
    };
});

beforeAll(async () => {
    // Artificial wait for translations to load
    await sleep(100);
    jest.useFakeTimers({ advanceTimers: 1, doNotFake: ["setTimeout"] });
});

process.on("unhandledRejection", (reason: Error) => {
    if (reason.message.startsWith("ETELEGRAM")) return;
    console.log("unhandledRejection", reason.name, reason.message);
});
