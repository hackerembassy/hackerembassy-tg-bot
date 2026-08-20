import { TEST_USERS } from "@data/seed";

import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Bot Admin commands:", () => {
    const mockBot = createMockBot();

    test("/setflag and /getflags roundtrip, restricted for non-admins", async () => {
        await mockBot.processUpdate(createMockMessage("/getflags", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/setflag hideGuests true", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/getflags", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/setflag hideGuests false", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual([
            '\\{"electricityOutageMentioned":false,"hideGuests":false\\}',
            "Flag hideGuests is set to true",
            '\\{"electricityOutageMentioned":false,"hideGuests":true\\}',
            "general\\.errors\\.restricted",
        ]);
    });

    test("/alias creates a working alias that /aliases lists and /unalias removes", async () => {
        await mockBot.processUpdate(createMockMessage("/alias /foo /status", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/aliases", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/unalias /foo", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/aliases", TEST_USERS.admin));

        expect(mockBot.popResults()).toEqual([
            "admin\\.alias\\.add\\.success",
            "admin\\.alias\\.help\n\nadmin\\.alias\\.list\\.text",
            "admin\\.alias\\.remove\\.success",
            "admin\\.alias\\.help\n\nadmin\\.alias\\.list\\.empty",
        ]);
    });

    test("admin-only commands are restricted for non-admin users", async () => {
        await mockBot.processUpdate(createMockMessage("/alias /bar /status", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/aliases", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/getflags", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual([
            "general\\.errors\\.restricted",
            "general\\.errors\\.restricted",
            "general\\.errors\\.restricted",
        ]);
    });

    test("/ban is restricted to members and refuses to ban privileged users", async () => {
        // Guests can't invoke it at all.
        await mockBot.processUpdate(createMockMessage("/ban guest", TEST_USERS.guest));

        // A plain member can't use it to ban another admin/accountant/member - only unprivileged users.
        await mockBot.processUpdate(createMockMessage("/ban admin", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/ban accountant", TEST_USERS.accountant));

        // It does work against an unprivileged (guest) target.
        await mockBot.processUpdate(createMockMessage("/ban guest", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "general\\.errors\\.restricted",
            "🙅 User cannot be banned",
            "🙅 User cannot be banned",
            "🔨 User is banned guest",
        ]);

        // Restore guest to its default role so later tests aren't affected by this one.
        await mockBot.processUpdate(createMockMessage("/unblock guest", TEST_USERS.admin));
        expect(mockBot.popResults()).toEqual(["admin\\.updateRoles\\.success"]);
    });

    test("/die is restricted to members", async () => {
        // Only checks the permission gate - never invoke this as an allowed user, since a
        // successful call schedules a real process.exit() a few seconds later via a real
        // (non-faked) setTimeout, which would kill the test worker.
        await mockBot.processUpdate(createMockMessage("/die", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted"]);
    });

    test("/copy is restricted to members", async () => {
        await mockBot.processUpdate(createMockMessage("/copy main", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted"]);
    });

    test("/getlogs, /cleanstate, and /stoplive (state/log access) are restricted to admins", async () => {
        await mockBot.processUpdate(createMockMessage("/getlogs", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/cleanstate", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/stoplive", TEST_USERS.accountant));

        await mockBot.processUpdate(createMockMessage("/cleanstate", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/stoplive", TEST_USERS.admin));

        expect(mockBot.popResults()).toEqual([
            "general\\.errors\\.restricted",
            "general\\.errors\\.restricted",
            "general\\.errors\\.restricted",
            "Cleared the bot persisted state\\. Message history and Live handlers are removed",
            "Live handlers are removed from this chat",
        ]);
    });

    test("/updateroles actually grants permissions, /removeuser actually revokes them, both restricted to admins", async () => {
        // A non-admin (even one with other elevated roles) can't grant roles or delete users.
        await mockBot.processUpdate(createMockMessage("/updateroles of guest to member", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/removeuser guest", TEST_USERS.accountant));

        await mockBot.processUpdate(createMockMessage("/addtopic probe", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/updateroles of guest to member", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/addtopic probe", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/removeuser guest", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/addtopic probe", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual([
            "general\\.errors\\.restricted",
            "general\\.errors\\.restricted",
            "general\\.errors\\.restricted",
            "admin\\.updateRoles\\.success",
            "topics\\.add\\.success",
            "admin\\.removeUser\\.success",
            "general\\.errors\\.restricted",
        ]);
    });
});
