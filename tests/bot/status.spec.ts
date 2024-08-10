import { TEST_USERS } from "@data/seed";

import { HackerEmbassyBotMock } from "../mocks/HackerEmbassyBotMock";
import { createMockBot, createMockMessage } from "../mocks/mockHelpers";

describe("Bot Status commands:", () => {
    const mockBot: HackerEmbassyBotMock = createMockBot();

    beforeAll(() => {
        fetchMock.mockReject(new Error("Mocked rejected embassyApi response"));
    });

    test("/open should change the /status of space to opened", async () => {
        await mockBot.processUpdate(createMockMessage("/open", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/status"));

        const results = mockBot.popResults();

        expect(results).toEqual([
            "status\\.open",
            "status\\.status\\.state\nstatus\\.status\\.nooneinside\n\n\x1astatus\\.status\\.updated",
        ]);
    });

    test("/status should mention people inside if -mention key is used", async () => {
        await mockBot.processUpdate(createMockMessage("/open", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/in", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/status -mention"));

        expect(mockBot.popResults()).toEqual([
            "status\\.open",
            "status\\.in\\.gotin\n\nstatus\\.in\\.tryautoinside",
            "status\\.status\\.state\nstatus\\.status\\.insidechecked@admin 🔑📒\n\n\x1astatus\\.status\\.updated",
        ]);
    });

    test("/out and /outforce should allow to leave anyone no matter if the space is opened or closed ", async () => {
        await mockBot.processUpdate(createMockMessage("/close", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/in", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage(`/inforce ${TEST_USERS.guest.username}`, TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/out", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/out", TEST_USERS.guest));
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
        await mockBot.processUpdate(createMockMessage("/open", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/out", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage(`/inforce ${TEST_USERS.guest.username}`, TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage(`/outforce ${TEST_USERS.guest.username.toUpperCase()}`, TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/status", TEST_USERS.admin));

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
        await mockBot.processUpdate(createMockMessage("/open", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage(`/inforce ${TEST_USERS.guest.username}`, TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage(`/inforce ${TEST_USERS.accountant.username}`, TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/close", TEST_USERS.admin));
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
