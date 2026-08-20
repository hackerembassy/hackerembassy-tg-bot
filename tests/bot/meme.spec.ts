import { TEST_USERS } from "@data/seed";

import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Bot Meme commands:", () => {
    const mockBot = createMockBot();

    test("/hug shows help without a target, sends a caption when targeting someone", async () => {
        await mockBot.processUpdate(createMockMessage("/hug", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/hug accountant", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["meme\\.hug\\.help", "meme\\.hug\\.user"]);
    });

    test("/slap shows help without a target, sends a caption when targeting someone", async () => {
        await mockBot.processUpdate(createMockMessage("/slap", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/slap accountant", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["meme\\.slap\\.help", "meme\\.slap\\.user"]);
    });
});
