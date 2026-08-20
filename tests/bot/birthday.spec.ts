import { TEST_USERS } from "@data/seed";

import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Bot Birthday commands:", () => {
    const mockBot = createMockBot();

    test("/mybirthday can set, view, and remove a birthday", async () => {
        await mockBot.processUpdate(createMockMessage("/mybirthday", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/mybirthday 07-15", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/mybirthday", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/mybirthday remove", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/mybirthday", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual([
            "birthday\\.notset\n\nbirthday\\.help",
            "birthday\\.set",
            "birthday\\.current\n\nbirthday\\.help",
            "birthday\\.remove",
            "birthday\\.notset\n\nbirthday\\.help",
        ]);
    });

    test("/birthdays lists users whose birthday falls in the current month", async () => {
        const today = new Date();
        const monthDay = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        await mockBot.processUpdate(createMockMessage(`/mybirthday ${monthDay}`, TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/birthdays"));
        await mockBot.processUpdate(createMockMessage("/mybirthday remove", TEST_USERS.accountant));

        const results = mockBot.popResults();

        expect(results[1]).toContain(TEST_USERS.accountant.username);
    });
});
