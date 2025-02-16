/* eslint-disable no-console */
import fetchMock from "jest-fetch-mock";

import { sleep } from "@utils/common";
import { getOrCreateDb, seedUsers } from "@data/scripts";
import { SEED_TEST_USERS } from "@data/seed";

fetchMock.enableMocks();

jest.mock("@services/funds/currency", () => {
    return {
        ...jest.requireActual("@services/funds/currency"),
        convert: jest.fn(),
        initConvert: jest.fn(),
        convertCurrency: jest.fn((amount: number) => amount),
        prepareCurrency: jest.fn((currency: string) => currency),
    };
});

jest.mock("@services/funds/export", () => {
    return {
        ...jest.requireActual("@services/funds/export"),
        getSponsorshipLevel: jest.fn(() => null),
    };
});

jest.mock("@utils/network", () => {
    return {
        default: jest.fn(),
        fetchWithTimeout: jest.fn().mockImplementation(fetchMock),
    };
});

jest.mock("../data/db", () => {
    const testDb = getOrCreateDb(true, ":memory:");

    seedUsers(SEED_TEST_USERS);

    return testDb;
});

jest.mock("@services/external/googleCalendar", () => ({
    getClosestEventsFromCalendar: jest.fn().mockReturnValue([]),
    getTodayEvents: jest.fn().mockReturnValue([]),
    getTodayEventsCached: jest.fn().mockReturnValue([]),
    getEventsJSON: jest.fn().mockReturnValue([]),
}));

jest.mock("@services/common/logger", () => {
    return {
        ...jest.requireActual("@services/common/logger"),
        log: jest.fn(),
        error: jest.fn().mockImplementation((error: Error | string) => {
            if (error instanceof Error && !error.message.startsWith("Mocked")) {
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
