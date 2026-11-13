import config from "config";
import fetchMock from "jest-fetch-mock";
import { Message } from "node-telegram-bot-api";

import { BotConfig } from "@config";
import { TEST_USERS } from "@data/seed";
import HackerEmbassyBot from "@hackembot/core/classes/HackerEmbassyBot";
import { InlineButton } from "@hackembot/core/inlineButtons";

import { createMockBot, createMockMessage } from "../../mocks/bot";

function fakeMessage(): Message {
    return {
        message_id: 1,
        date: 0,
        chat: { id: TEST_USERS.guest.userid, type: "private" },
        from: {
            id: TEST_USERS.guest.userid,
            is_bot: false,
            first_name: "First Name",
            username: TEST_USERS.guest.username,
        },
    };
}

describe("HackerEmbassyBot.sendOrEditMessage", () => {
    const bot = createMockBot();

    afterEach(() => jest.restoreAllMocks());

    it("sends a new message when the context is not mid-edit", async () => {
        const msg = fakeMessage();
        const sendMessageExt = jest.spyOn(bot, "sendMessageExt").mockResolvedValue({ message_id: 2 } as Message);
        const editMessageTextExt = jest.spyOn(bot, "editMessageTextExt");

        const result = await bot.sendOrEditMessage(msg.chat.id, "hello", msg, {}, 1);

        expect(sendMessageExt).toHaveBeenCalledWith(msg.chat.id, "hello", msg, {});
        expect(editMessageTextExt).not.toHaveBeenCalled();
        expect(result).toEqual({ message_id: 2 });
    });

    it("edits in place and clears isEditing when the context is mid-edit", async () => {
        const msg = fakeMessage();
        bot.context(msg).isEditing = true;
        const editMessageTextExt = jest.spyOn(bot, "editMessageTextExt").mockResolvedValue(true);

        const result = await bot.sendOrEditMessage(msg.chat.id, "hello", msg, {}, 42);

        expect(editMessageTextExt).toHaveBeenCalledWith("hello", msg, { chat_id: msg.chat.id, message_id: 42 });
        expect(result).toBe(true);
        expect(bot.context(msg).isEditing).toBe(false);
    });

    it("swallows an edit failure, resolves to null, and still clears isEditing", async () => {
        const msg = fakeMessage();
        bot.context(msg).isEditing = true;
        jest.spyOn(bot, "editMessageTextExt").mockRejectedValue(new Error("message is not modified"));

        const result = await bot.sendOrEditMessage(msg.chat.id, "hello", msg, {}, 42);

        expect(result).toBeNull();
        expect(bot.context(msg).isEditing).toBe(false);
    });
});

describe("HackerEmbassyBot.sendOrEditPhoto", () => {
    const bot = createMockBot();
    const photo = Buffer.from("fake image");

    afterEach(() => jest.restoreAllMocks());

    it("sends a new photo when the context is not mid-edit", async () => {
        const msg = fakeMessage();
        const sendPhotoExt = jest.spyOn(bot, "sendPhotoExt").mockResolvedValue({ message_id: 2 } as Message);
        const editPhoto = jest.spyOn(bot, "editPhoto");

        const result = await bot.sendOrEditPhoto(msg.chat.id, photo, msg, {});

        expect(sendPhotoExt).toHaveBeenCalledWith(msg.chat.id, photo, msg, {});
        expect(editPhoto).not.toHaveBeenCalled();
        expect(result).toEqual({ message_id: 2 });
    });

    it("edits in place and clears isEditing when the context is mid-edit", async () => {
        const msg = fakeMessage();
        bot.context(msg).isEditing = true;
        const editPhoto = jest.spyOn(bot, "editPhoto").mockResolvedValue(true);

        const result = await bot.sendOrEditPhoto(msg.chat.id, photo, msg, {});

        expect(editPhoto).toHaveBeenCalledWith(photo, msg, { chat_id: msg.chat.id, message_id: msg.message_id });
        expect(result).toBe(true);
        expect(bot.context(msg).isEditing).toBe(false);
    });

    it("swallows an edit failure, resolves to null, and still clears isEditing", async () => {
        const msg = fakeMessage();
        bot.context(msg).isEditing = true;
        jest.spyOn(bot, "editPhoto").mockRejectedValue(new Error("message is not modified"));

        const result = await bot.sendOrEditPhoto(msg.chat.id, photo, msg, {});

        expect(result).toBeNull();
        expect(bot.context(msg).isEditing).toBe(false);
    });
});

describe("HackerEmbassyBot unknown command guessing", () => {
    const bot = createMockBot();
    const guessHandler = jest.fn();
    const noop = jest.fn();

    bot.addEventRoutes(noop, noop, noop, guessHandler);

    beforeEach(() => guessHandler.mockClear());

    it("guesses an answer for an unknown command", async () => {
        await bot.routeMessage(createMockMessage("/makecoffee", TEST_USERS.admin).message!);

        expect(guessHandler).toHaveBeenCalledTimes(1);
    });

    it.each(["/usr/sbin/grub-probe: error", "/etc/fstab", "/home/user/"])("does not guess for path %s", async text => {
        await bot.routeMessage(createMockMessage(text, TEST_USERS.admin).message!);

        expect(guessHandler).not.toHaveBeenCalled();
    });
});

describe("HackerEmbassyBot button resolution on send", () => {
    const bot = createMockBot();

    it("applies display/deeplink for the target chat and keeps our fields off the wire", async () => {
        const main = config.get<BotConfig>("bot").chats.main;
        const inline_keyboard = [
            [InlineButton("Private only", "me", { display: "private" })],
            [InlineButton("Who", "status", { deeplink: "public" })],
        ];
        fetchMock.mockClear();

        // the mock bot overrides sendMessage to record text, so call the real one
        await HackerEmbassyBot.prototype.sendMessage.call(bot, main, "hi", { reply_markup: { inline_keyboard } });

        const [, request] = fetchMock.mock.calls.find(([url]) => (url as string).includes("sendMessage")) ?? [];
        const form = new URLSearchParams(request?.body as string);

        expect(JSON.parse(form.get("reply_markup") ?? "")).toEqual({
            inline_keyboard: [[{ text: "Who", url: `t.me/${config.get<BotConfig>("bot").name}?start=status` }]],
        });
    });
});
