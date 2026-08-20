import { TEST_USERS } from "@data/seed";

import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Bot Embassy commands:", () => {
    const mockBot = createMockBot();

    test("/text sets the LED matrix text or shows help", async () => {
        await mockBot.processUpdate(createMockMessage("/text", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/text Hello space", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["embassy\\.text\\.help", "embassy\\.text\\.success"]);
    });

    test("/play is restricted to trusted members", async () => {
        await mockBot.processUpdate(createMockMessage("/play some-sound", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/play some-sound", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted", "embassy\\.play\\.success"]);
    });

    test("/say announces a message in space or shows help", async () => {
        await mockBot.processUpdate(createMockMessage("/say", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/say Hello space", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["embassy\\.say\\.help", "embassy\\.say\\.success"]);
    });

    test("/stop is restricted to trusted members", async () => {
        await mockBot.processUpdate(createMockMessage("/stop", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/stop", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted", "embassy\\.stop\\.success"]);
    });
});
