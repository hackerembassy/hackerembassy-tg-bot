import { TEST_USERS } from "@data/seed";

import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Bot Subscriptions commands:", () => {
    const mockBot = createMockBot();

    test("a member can create a topic, users can subscribe, see it in their list, and unsubscribe", async () => {
        await mockBot.processUpdate(createMockMessage("/addtopic party A fun get-together", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/topics"));
        await mockBot.processUpdate(createMockMessage("/subscribe party", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/mysubscriptions", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/unsubscribe party", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/mysubscriptions", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual([
            "topics\\.add\\.success",
            "topics\\.topics\\.list",
            "topics\\.subscribe\\.success",
            "topics\\.subscriptions\\.list",
            "topics\\.unsubscribe\\.success",
            "topics\\.subscriptions\\.empty",
        ]);
    });

    test("guests are not allowed to create topics", async () => {
        await mockBot.processUpdate(createMockMessage("/addtopic notallowed", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted"]);
    });

    test("subscribing to an unknown topic reports notfound", async () => {
        await mockBot.processUpdate(createMockMessage("/subscribe nonexistenttopic123", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["topics\\.general\\.notfound"]);
    });
});
