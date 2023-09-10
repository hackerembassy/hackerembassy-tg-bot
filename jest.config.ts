import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
    preset: "ts-jest",
    testEnvironment: "node",
    setupFilesAfterEnv: ["<rootDir>/tests/jestSetup.ts"],
    reporters: [["github-actions", { silent: false }], "default", "summary"],
    testLocationInResults: true,
};

export default jestConfig;
