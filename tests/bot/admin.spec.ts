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

    test("/updateroles actually grants permissions, /removeuser actually revokes them", async () => {
        await mockBot.processUpdate(createMockMessage("/addtopic probe", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/updateroles of guest to member", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/addtopic probe", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/removeuser guest", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/addtopic probe", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual([
            "general\\.errors\\.restricted",
            "admin\\.updateRoles\\.success",
            "topics\\.add\\.success",
            "admin\\.removeUser\\.success",
            "general\\.errors\\.restricted",
        ]);
    });
});
