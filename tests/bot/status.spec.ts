import { HackerEmbassyBotMock } from "../mocks/HackerEmbassyBotMock";
import { ADMIN_USER_NAME, createBotMock, createMockMessage, GUEST_USER_NAME, prepareDb } from "../mocks/mockHelpers";

describe("Bot Status commands:", () => {
    const botMock: HackerEmbassyBotMock = createBotMock();

    beforeAll(() => {
        fetchMock.mockReject(new Error("Mocked fetch error"));
        prepareDb();
        jest.useFakeTimers({ advanceTimers: 1, doNotFake: ["setTimeout"] });
    });

    test("/open should change the /status of space to opened", async () => {
        await botMock.processUpdate(createMockMessage("/open", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/status"));

        await jest.runAllTimersAsync();

        const results = botMock.popResults();

        expect(results).toEqual([
            "status\\.open",
            "status\\.status\\.state\nstatus\\.status\\.insidechecked[adminusername](t\\.me/adminusername) 🔑📒\n\nstatus\\.status\\.updated",
        ]);
    });

    test("/out and /outforce should allow to leave anyone no matter if the space is opened or closed ", async () => {
        await botMock.processUpdate(createMockMessage("/close", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/in", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage(`/inforce ${GUEST_USER_NAME}`, ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/out", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/out", GUEST_USER_NAME));
        await botMock.processUpdate(createMockMessage("/status"));

        await jest.runAllTimersAsync();

        const results = botMock.popResults();

        expect(results).toEqual([
            "status\\.close",
            "status\\.in\\.gotin",
            "status\\.inforce\\.gotin",
            "status\\.out\\.gotout",
            "status\\.out\\.gotout",
            "status\\.status\\.state\nstatus\\.status\\.nooneinside\n\nstatus\\.status\\.updated",
        ]);
    });

    test("username case should not matter when executing /inforce and /outforce", async () => {
        await botMock.processUpdate(createMockMessage("/open", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/out", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/inforce caseuser", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/inforce regularuser", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/outforce CASEUSER", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/status", ADMIN_USER_NAME));

        await jest.runAllTimersAsync();

        const results = botMock.popResults();

        expect(results).toEqual([
            "status\\.open",
            "status\\.out\\.gotout",
            "status\\.inforce\\.gotin",
            "status\\.inforce\\.gotin",
            "status\\.outforce\\.gotout",
            "status\\.status\\.state\nstatus\\.status\\.insidechecked[regularuser](t\\.me/regularuser) \n\nstatus\\.status\\.updated",
        ]);
    });

    test("/close should change the /status of space to closed and remove users inside", async () => {
        await botMock.processUpdate(createMockMessage("/open", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/inforce user1", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/inforce user2", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/inforce user3", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/close", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/status"));

        await jest.runAllTimersAsync();

        const results = botMock.popResults();

        expect(results).toEqual([
            "status\\.open",
            "status\\.inforce\\.gotin",
            "status\\.inforce\\.gotin",
            "status\\.inforce\\.gotin",
            "status\\.close",
            "status\\.status\\.state\nstatus\\.status\\.nooneinside\n\nstatus\\.status\\.updated",
        ]);
    });
});
