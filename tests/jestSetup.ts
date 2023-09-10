import Database from "better-sqlite3";

import { sleep } from "../utils/common";

jest.mock("../utils/currency", () => {
    const currencyModule = jest.requireActual("../utils/currency");
    return {
        ...currencyModule,
        convert: jest.fn(),
        initConvert: jest.fn(),
        convertCurrency: jest.fn((amount: number) => amount),
        prepareCurrency: jest.fn((currency: string) => currency),
    };
});

jest.mock("../utils/network", () => {
    return {
        default: jest.fn(),
        fetchWithTimeout: jest.fn(),
    };
});

const sampleDb = new Database("./data/sample.db");

jest.mock("../data/db", () => {
    return new Database(sampleDb.serialize());
});

beforeAll(async () => {
    // Artificial wait for translations to load
    await sleep(100);
});
