import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
    preset: "ts-jest",
    testEnvironment: "node",
    setupFilesAfterEnv: ["<rootDir>/tests/jestSetup.ts"],
    reporters: [["github-actions", { silent: false }], "default", "summary"],
    testLocationInResults: true,
    testPathIgnorePatterns: ["<rootDir>/dist/"],
    moduleNameMapper: {
        "^@utils/(.*)$": "<rootDir>/utils/$1",
        "^@services/(.*)$": "<rootDir>/services/$1",
        "^@data/(.*)$": "<rootDir>/data/$1",
        "^@repositories/(.*)$": "<rootDir>/repositories/$1",
        "^@hackembot/(.*)$": "<rootDir>/bot/$1",
        "^@hackemapi/(.*)$": "<rootDir>/api/$1",
        "^@config$": "<rootDir>/config/schema",
    },
};

export default jestConfig;
