import { TEST_USERS } from "@data/seed";
import MemeController from "@hackembot/controllers/meme";
import * as filesystem from "@utils/filesystem";

import { createMockBot, createMockMessage } from "../../mocks/bot";

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

    describe.each(["slap", "hug"] as const)("/%s animations", command => {
        const handler = command === "slap" ? MemeController.slapHandler : MemeController.hugHandler;

        beforeEach(() => {
            jest.spyOn(filesystem, "getImageFromPath").mockResolvedValue(Buffer.from("gif"));
        });

        afterEach(() => {
            jest.restoreAllMocks();
            mockBot.popResults();
        });

        test.each(["guest", "@guest", "guest_name", "@guest_name"])("uses the self animation for %s", async target => {
            const sender = { ...TEST_USERS.guest, username: target.replace("@", "") };
            const msg = createMockMessage(`/${command} ${target}`, sender).message!;
            mockBot.startContext(msg, sender);

            await handler(mockBot, msg, target);

            expect(filesystem.getImageFromPath).toHaveBeenCalledWith(`./resources/images/animations/${command}-self.gif`);
        });

        test("uses the self animation when replying to oneself", async () => {
            const sender = { ...TEST_USERS.guest, username: "guest_name" };
            const msg = createMockMessage(`/${command}`, sender).message!;
            msg.reply_to_message = createMockMessage("hello", sender).message;
            mockBot.startContext(msg, sender);

            await handler(mockBot, msg);

            expect(filesystem.getImageFromPath).toHaveBeenCalledWith(`./resources/images/animations/${command}-self.gif`);
        });

        test("preserves the special bot animation", async () => {
            const msg = createMockMessage(`/${command} @${mockBot.name}`).message!;
            mockBot.startContext(msg, TEST_USERS.guest);

            await handler(mockBot, msg, `@${mockBot.name}`);

            expect(filesystem.getImageFromPath).toHaveBeenCalledWith(`./resources/images/animations/${command}-bot.gif`);
        });

        test("uses the main pool for another user", async () => {
            const msg = createMockMessage(`/${command} @other_user`).message!;
            mockBot.startContext(msg, { ...TEST_USERS.guest, username: "guest_name" });

            await handler(mockBot, msg, "@other_user");

            expect(filesystem.getImageFromPath).toHaveBeenCalledWith(
                expect.stringMatching(new RegExp(`^\\./resources/images/animations/${command}-\\d\\.gif$`))
            );
        });
    });
});
