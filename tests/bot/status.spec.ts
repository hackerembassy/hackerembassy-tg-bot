import { sleep } from "../../utils/common";
import { HackerEmbassyBotMock } from "../mocks/HackerEmbassyBotMock";
import { cleanDb, createBotMock, createMockMessage, prepareDb } from "../mocks/mockHelpers";

function removeStatusUpdatedDate(input: string): string {
    return input.replace(/\s\d\d.*\n/gm, "");
}

describe("HackerEmbassyBotMock", () => {
    const botMock: HackerEmbassyBotMock = createBotMock();

    beforeAll(async () => {
        prepareDb();

        await sleep(100);
    });

    beforeEach(async () => {});

    test("/status show open space after /open", async () => {
        await botMock.processUpdate(createMockMessage("/open"));
        await botMock.processUpdate(createMockMessage("/status"));

        await Promise.resolve(process.nextTick);

        const results = botMock.popResults();
        results[results.length - 1] = removeStatusUpdatedDate(results[results.length - 1]);

        expect(results).toEqual([
            "status\\.open",
            "status\\.status\\.state\n" +
                "status\\.status\\.insidechecked[adminusername](t\\.me/adminusername) 🔑📒\n\n" +
                "⏱ status\\.status\\.updated",
        ]);
    });

    test("/status should show space without users after /close", async () => {
        await botMock.processUpdate(createMockMessage("/open"));
        await botMock.processUpdate(createMockMessage("/inforce user1"));
        await botMock.processUpdate(createMockMessage("/inforce user2"));
        await botMock.processUpdate(createMockMessage("/inforce user3"));
        await botMock.processUpdate(createMockMessage("/close"));
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
            "status\\.status\\.state\n" + "status\\.status\\.nooneinside\n" + "\n" + "⏱ status\\.status\\.updated",
        ]);
    });

    afterAll(() => {
        cleanDb();
    });
});
