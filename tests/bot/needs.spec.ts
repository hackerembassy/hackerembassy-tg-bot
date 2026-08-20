import { TEST_USERS } from "@data/seed";

import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Bot Needs commands:", () => {
    const mockBot = createMockBot();

    test("/buy adds an item to /needs, and /bought closes it", async () => {
        await mockBot.processUpdate(createMockMessage("/needs"));
        await mockBot.processUpdate(createMockMessage("/buy solder wire", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/needs"));
        await mockBot.processUpdate(createMockMessage("/bought solder wire", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/needs"));

        expect(mockBot.popResults()).toEqual([
            "needs\\.buy\\.nothing\n\nneeds\\.buy\\.helpbuy",
            "needs\\.buy\\.success",
            "needs\\.buy\\.pleasebuy\n\\- `solder wire` needs\\.buy\\.byrequest [guest](tg://user?id\\=12)\n\nneeds\\.buy\\.helpbuyneeds\\.buy\\.helpbought",
            "needs\\.bought\\.success",
            "needs\\.buy\\.nothing\n\nneeds\\.buy\\.helpbuy",
        ]);
    });

    test("/bought reports notfound for an item nobody requested", async () => {
        await mockBot.processUpdate(createMockMessage("/bought nonexistent_item_xyz"));

        expect(mockBot.popResults()).toEqual(["needs\\.bought\\.notfound"]);
    });
});
