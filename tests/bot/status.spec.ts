import { HackerEmbassyBotMock } from "../mocks/HackerEmbassyBotMock";
import { ADMIN_USER_NAME, createBotMock, createMockMessage, prepareDb } from "../mocks/mockHelpers";

function removeStatusUpdatedDate(input: string): string {
    return input.replace(/\s\d\d.*\n/m, "");
}

describe("Bot Status commands:", () => {
    const botMock: HackerEmbassyBotMock = createBotMock();

    beforeAll(async () => {
        prepareDb();
    });

    beforeEach(async () => {});

    test("/open should change the /status of space to opened", async () => {
        await botMock.processUpdate(createMockMessage("/open", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/status"));

        await Promise.resolve(process.nextTick);

        const results = botMock.popResults();
        results[results.length - 1] = removeStatusUpdatedDate(results[results.length - 1]);

        expect(results).toEqual([
            "status\\.open",
            "status\\.status\\.state\nstatus\\.status\\.insidechecked[adminusername](t\\.me/adminusername) 🔑📒\n\n⏱ status\\.status\\.updated",
        ]);
    });

    test("/close should change the /status of space to closed and remove users inside", async () => {
        await botMock.processUpdate(createMockMessage("/open", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/inforce user1", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/inforce user2", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/inforce user3", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/close", ADMIN_USER_NAME));
        await Promise.resolve(process.nextTick);
        await botMock.processUpdate(createMockMessage("/status"));
        await Promise.resolve(process.nextTick);

        const results = botMock.popResults();

        results[results.length - 1] = removeStatusUpdatedDate(results[results.length - 1]);

        expect(results).toEqual([
            "status\\.open",
            "status\\.inforce\\.gotin",
            "status\\.inforce\\.gotin",
            "status\\.inforce\\.gotin",
            "status\\.close",
            "status\\.status\\.state\nstatus\\.status\\.nooneinside\n\n⏱ status\\.status\\.updated",
        ]);
    });
});
