import { TEST_USERS } from "@data/seed";

import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Bot Service commands:", () => {
    const mockBot = createMockBot();

    test("/setlanguage rejects unsupported input and offers a selector otherwise", async () => {
        await mockBot.processUpdate(createMockMessage("/setlanguage xx", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/setlanguage", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["service\\.setlanguage\\.notsupported", "service\\.setlanguage\\.select"]);
    });

    test("/token can be set, viewed, and removed by a trusted member", async () => {
        await mockBot.processUpdate(createMockMessage("/token set", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/token set", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/token remove", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/token remove", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "service\\.token\\.set",
            "service\\.token\\.exists",
            "service\\.token\\.removed",
            "service\\.token\\.missing",
        ]);
    });

    test("/token is restricted for guests", async () => {
        await mockBot.processUpdate(createMockMessage("/token set", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted"]);
    });

    test("/chatid reports the chat's id", async () => {
        await mockBot.processUpdate(createMockMessage("/chatid", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual([`chatId: ${TEST_USERS.guest.userid}`]);
    });
});
