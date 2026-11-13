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

function photoMessage(fileId: string): Message {
    return {
        message_id: 2,
        date: 0,
        chat: { id: TEST_USERS.guest.userid, type: "private" },
        photo: [{ file_id: fileId, file_unique_id: "u", width: 1, height: 1 }],
    };
}

describe("HackerEmbassyBot file_id caching", () => {
    const bot = createMockBot();
    let sendPhoto: jest.SpiedFunction<typeof bot.sendPhoto>;
    let uploads = 0;

    beforeEach(() => {
        bot.botState.fileIdCache.clear();
        uploads = 0;
        sendPhoto = jest.spyOn(bot, "sendPhoto").mockImplementation(() => Promise.resolve(photoMessage(`file-${++uploads}`)));
    });

    afterEach(() => jest.restoreAllMocks());

    it("reuses the file_id of previously sent media", async () => {
        await bot.sendPhotoExt(TEST_USERS.guest.userid, Buffer.from("img"), fakeMessage());
        await bot.sendPhotoExt(TEST_USERS.guest.userid, Buffer.from("img"), fakeMessage());

        expect(sendPhoto.mock.calls[1][1]).toBe("file-1");
    });

    it("skips caching with noCache and never forwards the option to Telegram", async () => {
        await bot.sendPhotoExt(TEST_USERS.guest.userid, Buffer.from("frame"), fakeMessage(), { noCache: true });
        await bot.sendPhotoExt(TEST_USERS.guest.userid, Buffer.from("frame"), fakeMessage(), { noCache: true });

        expect(sendPhoto.mock.calls[1][1]).toEqual(Buffer.from("frame"));
        expect(sendPhoto.mock.calls[0][2]).not.toHaveProperty("noCache");
        expect(bot.botState.fileIdCache.size).toBe(0);
    });

    it("does not cache file_ids, but does cache local paths", async () => {
        await bot.sendPhotoExt(TEST_USERS.guest.userid, "AgACAgIAAxkBAAIBY2Zabc_def-123", fakeMessage());
        expect(bot.botState.fileIdCache.size).toBe(0);

        await bot.sendPhotoExt(TEST_USERS.guest.userid, "./resources/images/house.jpg", fakeMessage());
        expect(bot.botState.fileIdCache.size).toBe(1);
    });

    it("re-uploads and replaces a cached file_id that Telegram rejects", async () => {
        await bot.sendPhotoExt(TEST_USERS.guest.userid, Buffer.from("img"), fakeMessage());
        sendPhoto.mockImplementationOnce(() => Promise.reject(new Error("Bad Request: wrong file identifier")));

        await bot.sendPhotoExt(TEST_USERS.guest.userid, Buffer.from("img"), fakeMessage());

        expect(sendPhoto.mock.calls[2][1]).toEqual(Buffer.from("img"));
        expect(Object.values(bot.botState.fileIdCache.toJSON())).toEqual(["file-2"]);
    });

    it("keeps the cached file_id when the send fails for an unrelated reason", async () => {
        await bot.sendPhotoExt(TEST_USERS.guest.userid, Buffer.from("img"), fakeMessage());
        sendPhoto.mockImplementationOnce(() => Promise.reject(new Error("Bad Request: chat not found")));

        await expect(bot.sendPhotoExt(TEST_USERS.guest.userid, Buffer.from("img"), fakeMessage())).rejects.toThrow(
            "chat not found"
        );
        expect(Object.values(bot.botState.fileIdCache.toJSON())).toEqual(["file-1"]);
    });

    it("cacheFileId ignores boolean edit results and replaces entries by prefix", () => {
        bot.cacheFileId("donut:1:a", true, "donut:1:");
        expect(bot.botState.fileIdCache.size).toBe(0);

        bot.cacheFileId("donut:1:a", photoMessage("old"), "donut:1:");
        bot.cacheFileId("donut:1:b", photoMessage("new"), "donut:1:");
        expect(bot.botState.fileIdCache.toJSON()).toEqual({ "donut:1:b": "new" });

        bot.forgetFileId("donut:1:b");
        expect(bot.botState.fileIdCache.size).toBe(0);
    });

    it("withContext lends the captured context to another message and clears it afterwards", async () => {
        const source = fakeMessage();
        const context = bot.context(source);
        context.mode.static = true;
        const target = { ...photoMessage("x"), from: undefined } as Message;

        const seenStatic = await bot.withContext(target, context, () => Promise.resolve(bot.context(target).mode.static));

        expect(seenStatic).toBe(true);
        expect(() => bot.context(target)).toThrow("Message missing the sender");
        bot.clearContext(source);
    });
});
