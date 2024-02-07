/* eslint-disable no-console */
import Database from "better-sqlite3";
import fetchMock from "jest-fetch-mock";

import { sleep } from "../utils/common";

fetchMock.enableMocks();

jest.mock("../utils/currency", () => {
    return {
        ...jest.requireActual("../utils/currency"),
        convert: jest.fn(),
        initConvert: jest.fn(),
        convertCurrency: jest.fn((amount: number) => amount),
        prepareCurrency: jest.fn((currency: string) => currency),
    };
});

jest.mock("../utils/network", () => {
    return {
        default: jest.fn(),
        fetchWithTimeout: jest.fn().mockImplementation(fetchMock),
    };
});

const sampleDb = new Database("./data/sample.db");

jest.mock("../data/db", () => {
    return new Database(sampleDb.serialize());
});

jest.mock("../services/logger", () => {
    return {
        ...jest.requireActual("../services/logger"),
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
});

process.on("unhandledRejection", (reason: Error) => {
    if (reason.message.startsWith("ETELEGRAM")) return;
    console.log("unhandledRejection", reason.name, reason.message);
});
