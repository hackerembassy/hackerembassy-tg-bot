import config from "config";

import { BotConfig } from "@config";
import logger from "@services/common/logger";
import { ButtonFlags, InlineButton, resolveKeyboard } from "@hackembot/core/inlineButtons";

const botConfig = config.get<BotConfig>("bot");
const PRIVATE_CHAT = 12345;
const OTHER_GROUP = botConfig.chats.key;
const MAIN = botConfig.chats.main;
const OFFTOPIC = botConfig.chats.offtopic;

const autoinsideLink = (params: unknown) => InlineButton("x", "autoinside", { deeplink: "always", params }).url;
const keyboardIn = (chatId: number, ...buttons: ReturnType<typeof InlineButton>[]) => resolveKeyboard([buttons], chatId);
const textsIn = (chatId: number, ...buttons: ReturnType<typeof InlineButton>[]) =>
    keyboardIn(chatId, ...buttons).flatMap(row => row.map(button => button.text));

describe("InlineButton", () => {
    test("serializes only callback fields and keeps style on the button", () => {
        const button = InlineButton("Refresh", "status", { flags: ButtonFlags.Editing, params: "x", style: "danger" });

        expect(button).toEqual({
            text: "Refresh",
            callback_data: JSON.stringify({ cmd: "status", fs: ButtonFlags.Editing, params: "x" }),
            style: "danger",
        });
    });

    test("default display adds no field", () => {
        expect(InlineButton("A", "a", { display: "everywhere" })).not.toHaveProperty("display");
        expect(InlineButton("A", "a")).not.toHaveProperty("display");
    });

    test("deeplink always builds a start link", () => {
        expect(InlineButton("About", "about", { deeplink: "always" })).toEqual({
            text: "About",
            url: `t.me/${botConfig.name}?start=about`,
        });
    });

    test("deeplink carries simple params and drops ones Telegram would reject", () => {
        expect(autoinsideLink("enable")).toBe(`t.me/${botConfig.name}?start=autoinside__enable`);
        expect(autoinsideLink(["ac", -1])).toBe(`t.me/${botConfig.name}?start=autoinside__ac__-1`);
        expect(autoinsideLink("has spaces")).toBe(`t.me/${botConfig.name}?start=autoinside`);
        expect(autoinsideLink("a".repeat(64))).toBe(`t.me/${botConfig.name}?start=autoinside`);
        expect(autoinsideLink({ nested: true })).toBe(`t.me/${botConfig.name}?start=autoinside`);
    });

    test("disabled wins over callback and deeplink but keeps style", () => {
        expect(InlineButton("Control", "controlpanel", { disabled: true, deeplink: "always", style: "primary" })).toEqual({
            text: "Control",
            disabled: {},
            style: "primary",
        });
    });
});

describe("resolveKeyboard", () => {
    test("deeplink public becomes a link in main/offtopic and stays a callback elsewhere", () => {
        const button = InlineButton("Auto", "autoinside", { deeplink: "public", params: "enable", style: "success" });
        const link = { text: "Auto", url: `t.me/${botConfig.name}?start=autoinside__enable`, style: "success" };
        const callback = { text: "Auto", callback_data: button.callback_data, style: "success" };

        expect(keyboardIn(MAIN, button)).toEqual([[link]]);
        expect(keyboardIn(OFFTOPIC, button)).toEqual([[link]]);
        expect(keyboardIn(PRIVATE_CHAT, button)).toEqual([[callback]]);
        expect(keyboardIn(OTHER_GROUP, button)).toEqual([[callback]]);
    });

    test("display filters per chat kind", () => {
        const buttons = (["everywhere", "private", "public", "groups", "nonpublic"] as const).map(display =>
            InlineButton(display, "x", { display })
        );

        expect(textsIn(PRIVATE_CHAT, ...buttons)).toEqual(["everywhere", "private", "nonpublic"]);
        expect(textsIn(MAIN, ...buttons)).toEqual(["everywhere", "public", "groups"]);
        expect(textsIn(OFFTOPIC, ...buttons)).toEqual(["everywhere", "public", "groups"]);
        expect(textsIn(OTHER_GROUP, ...buttons)).toEqual(["everywhere", "groups", "nonpublic"]);
    });

    test("strips our fields, drops emptied rows and leaves the input untouched", () => {
        const hidden = InlineButton("Hidden", "x", { display: "private", disabled: true });
        const kept = InlineButton("Kept", "y", { display: "groups", deeplink: "public" });
        const options = { reply_markup: { inline_keyboard: [[hidden], [kept]] } };
        const snapshot = structuredClone(options);

        const resolved = resolveKeyboard(options.reply_markup.inline_keyboard, OTHER_GROUP);

        expect(resolved).toEqual([[{ text: "Kept", callback_data: kept.callback_data }]]);
        expect(options).toEqual(snapshot);
    });

    test("warns at send time, not build time, about oversized callback_data", () => {
        const warn = jest.spyOn(logger, "warn").mockImplementation(() => logger);
        warn.mockClear();
        const big = InlineButton("Big", "w", { params: "x".repeat(80) });

        expect(warn).not.toHaveBeenCalled();
        resolveKeyboard([[big]], PRIVATE_CHAT);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("callback_data over 64 bytes"));

        warn.mockRestore();
    });

    test("warns when deeplink params have to be dropped", () => {
        const warn = jest.spyOn(logger, "warn").mockImplementation(() => logger);
        warn.mockClear();

        autoinsideLink("has spaces");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Deeplink params dropped for /autoinside"));

        warn.mockRestore();
    });

    test("unknown chat only strips", () => {
        const button = InlineButton("A", "a", { display: "private", deeplink: "public" });

        expect(resolveKeyboard([[button]])).toEqual([[{ text: "A", callback_data: button.callback_data }]]);
    });
});
