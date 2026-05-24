import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
    preset: "ts-jest",
    testEnvironment: "node",
    setupFilesAfterEnv: ["<rootDir>/tests/jestSetup.ts"],
    reporters: [["github-actions", { silent: false }], "default", "summary"],
    testLocationInResults: true,
    testPathIgnorePatterns: ["<rootDir>/dist/"],
    moduleNameMapper: {
        "^@utils/(.*)$": "<rootDir>/src/utils/$1",
        "^@services/(.*)$": "<rootDir>/src/services/$1",
        "^@data/(.*)$": "<rootDir>/src/data/$1",
        "^@constants/(.*)$": "<rootDir>/src/constants/$1",
        "^@hackembot/(.*)$": "<rootDir>/src/bot/$1",
        "^@hackemapi/(.*)$": "<rootDir>/src/api/$1",
        "^@config$": "<rootDir>/config/schema",
    },
};

export default jestConfig;
