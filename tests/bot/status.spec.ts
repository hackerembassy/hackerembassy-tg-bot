import { ACCOUNTANT_USER, ADMIN_USER, GUEST_USER, prepareDb } from "../dbSetup";
import { HackerEmbassyBotMock } from "../mocks/HackerEmbassyBotMock";
import { createMockBot, createMockMessage } from "../mocks/mockHelpers";

describe("Bot Status commands:", () => {
    const mockBot: HackerEmbassyBotMock = createMockBot();

    beforeAll(() => {
        fetchMock.mockReject(new Error("Mocked rejected embassyApi response"));
        prepareDb();
    });

    test("/open should change the /status of space to opened", async () => {
        await mockBot.processUpdate(createMockMessage("/open", ADMIN_USER));
        await mockBot.processUpdate(createMockMessage("/status"));

        const results = mockBot.popResults();

        expect(results).toEqual([
            "status\\.open",
            "status\\.status\\.state\nstatus\\.status\\.nooneinside\n\n\x1astatus\\.status\\.updated",
        ]);
    });

    test("/status should mention people inside if -mention key is used", async () => {
        await mockBot.processUpdate(createMockMessage("/open", ADMIN_USER));
        await mockBot.processUpdate(createMockMessage("/in", ADMIN_USER));
        await mockBot.processUpdate(createMockMessage("/status -mention"));

        expect(mockBot.popResults()).toEqual([
            "status\\.open",
            "status\\.in\\.gotin\n\nstatus\\.in\\.tryautoinside",
            "status\\.status\\.state\nstatus\\.status\\.insidechecked@adminusername 🔑📒\n\n\x1astatus\\.status\\.updated",
        ]);
    });

    test("/out and /outforce should allow to leave anyone no matter if the space is opened or closed ", async () => {
        await mockBot.processUpdate(createMockMessage("/close", ADMIN_USER));
        await mockBot.processUpdate(createMockMessage("/in", ADMIN_USER));
        await mockBot.processUpdate(createMockMessage(`/inforce ${GUEST_USER.username}`, ADMIN_USER));
        await mockBot.processUpdate(createMockMessage("/out", ADMIN_USER));
        await mockBot.processUpdate(createMockMessage("/out", GUEST_USER));
        await mockBot.processUpdate(createMockMessage("/status"));

        const results = mockBot.popResults();

        expect(results).toEqual([
            "status\\.close",
            "status\\.in\\.gotin\n\nstatus\\.in\\.tryautoinside",
            "status\\.inforce\\.gotin",
            "status\\.out\\.gotout",
            "status\\.out\\.gotout",
            "status\\.status\\.state\nstatus\\.status\\.nooneinside\n\n\x1astatus\\.status\\.updated",
        ]);
    });

    test("username case should not matter when executing /inforce and /outforce", async () => {
        await mockBot.processUpdate(createMockMessage("/open", ADMIN_USER));
        await mockBot.processUpdate(createMockMessage("/out", ADMIN_USER));
        await mockBot.processUpdate(createMockMessage(`/inforce ${GUEST_USER.username}`, ADMIN_USER));
        await mockBot.processUpdate(createMockMessage(`/outforce ${GUEST_USER.username.toUpperCase()}`, ADMIN_USER));
        await mockBot.processUpdate(createMockMessage("/status", ADMIN_USER));

        const results = mockBot.popResults();

        expect(results).toEqual([
            "status\\.open",
            "status\\.out\\.gotout",
            "status\\.inforce\\.gotin",
            "status\\.outforce\\.gotout",
            "status\\.status\\.state\nstatus\\.status\\.nooneinside\n\n\x1astatus\\.status\\.updated",
        ]);
    });

    test("/close should change the /status of space to closed and remove users inside", async () => {
        await mockBot.processUpdate(createMockMessage("/open", ADMIN_USER));
        await mockBot.processUpdate(createMockMessage(`/inforce ${GUEST_USER.username}`, ADMIN_USER));
        await mockBot.processUpdate(createMockMessage(`/inforce ${ACCOUNTANT_USER.username}`, ADMIN_USER));
        await mockBot.processUpdate(createMockMessage("/close", ADMIN_USER));
        await mockBot.processUpdate(createMockMessage("/status"));

        const results = mockBot.popResults();

        expect(results).toEqual([
            "status\\.open",
            "status\\.inforce\\.gotin",
            "status\\.inforce\\.gotin",
            "status\\.close",
            "status\\.status\\.state\nstatus\\.status\\.nooneinside\n\n\x1astatus\\.status\\.updated",
        ]);
    });
});
