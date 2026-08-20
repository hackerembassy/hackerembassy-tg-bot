import { TEST_USERS } from "@data/seed";

import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Bot Status commands:", () => {
    const mockBot = createMockBot();

    test("/open should change the /status of space to opened", async () => {
        await mockBot.processUpdate(createMockMessage("/open", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/status"));

        const results = mockBot.popResults();

        expect(results).toEqual([
            "status\\.open",
            "status\\.status\\.state\nstatus\\.status\\.nooneinside\n\n\x1astatus\\.status\\.updated",
        ]);
    });

    test("/open and /close are restricted to members", async () => {
        await mockBot.processUpdate(createMockMessage("/open", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/close", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted", "general\\.errors\\.restricted"]);
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

    test("/evict kicks everyone out and is restricted for guests", async () => {
        await mockBot.processUpdate(createMockMessage("/open", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage(`/inforce ${TEST_USERS.guest.username}`, TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/evict", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/evict", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/status"));

        expect(mockBot.popResults()).toEqual([
            "status\\.open",
            "status\\.inforce\\.gotin",
            "general\\.errors\\.restricted",
            "status\\.evict",
            "status\\.status\\.state\nstatus\\.status\\.nooneinside\n\n\x1astatus\\.status\\.updated",
        ]);
    });

    test("/setemoji sets, checks, and removes a status emoji, restricted for guests", async () => {
        await mockBot.processUpdate(createMockMessage("/setemoji 🎉", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/setemoji status", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/setemoji remove", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/setemoji status", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/setemoji 🎉", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual([
            "status\\.emoji\\.set",
            "status\\.emoji\\.isset",
            "status\\.emoji\\.removed",
            "status\\.emoji\\.isnotset",
            "general\\.errors\\.restricted",
        ]);
    });

    test("/going and /notgoing record RSVP intent", async () => {
        await mockBot.processUpdate(createMockMessage("/going", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/notgoing", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["status\\.going", "status\\.notgoing"]);
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
