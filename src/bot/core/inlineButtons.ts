import config from "config";
import { ChatId, InlineKeyboardButton } from "node-telegram-bot-api";

import { BotConfig } from "@config";
import logger from "@services/common/logger";

import { CallbackData } from "./types";

const botConfig = config.get<BotConfig>("bot");
const AnnoyingChats = new Set([botConfig.chats.main, botConfig.chats.offtopic]);

export enum ButtonFlags {
    Simple = 0,
    Editing = 1 << 0, // 01
    Silent = 1 << 1, // 10
}

// Rough mobile-width budget per row - Telegram wraps inline buttons at a pixel width, not a
// character count, but this keeps rows of short labels multi-column while long labels drop to one per row.
const MAX_BUTTON_ROW_CHARS = 30;

export function chunkButtonsForMobile<T extends { text: string }>(buttons: T[], maxPerRow = 3): T[][] {
    const rows: T[][] = [];
    let currentRow: T[] = [];
    let currentRowChars = 0;

    for (const button of buttons) {
        const wouldOverflow =
            currentRow.length >= maxPerRow ||
            (currentRow.length > 0 && currentRowChars + button.text.length > MAX_BUTTON_ROW_CHARS);

        if (wouldOverflow) {
            rows.push(currentRow);
            currentRow = [];
            currentRowChars = 0;
        }

        currentRow.push(button);
        currentRowChars += button.text.length;
    }

    if (currentRow.length > 0) rows.push(currentRow);

    return rows;
}

// Bot API 9.4: red / green / blue button colors
export type ButtonStyle = "danger" | "success" | "primary";

// public: deeplink into the bot's private chat when sent to main/offtopic, callback elsewhere
// always: deeplink everywhere
export type DeepLinkMode = "public" | "always";

// Which chats the button is shown in; "public" means main/offtopic
export type ButtonDisplay = "everywhere" | "private" | "public" | "groups" | "nonpublic";

export type InlineButtonOptions = {
    flags?: ButtonFlags;
    params?: unknown;
    vId?: number;
    style?: ButtonStyle;
    deeplink?: DeepLinkMode;
    display?: ButtonDisplay;
    // Bot API 10.3: button that does nothing; how it looks is up to the app.
    // Keyboards are shared by everyone who sees the message, so only disable per-user in private chats.
    disabled?: boolean;
};

// 1.2.0 types predate the disabled field. display/deeplink are ours, resolved and stripped by resolveKeyboard.
export type InlineButtonResult = InlineKeyboardButton & { disabled?: object; display?: ButtonDisplay; deeplink?: "public" };

// Telegram rejects the whole keyboard if any button's callback_data is over this
export const MAX_CALLBACK_DATA_BYTES = 64;

const START_PARAM_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

export function isPublicChat(chatId?: ChatId): boolean {
    return typeof chatId === "number" && AnnoyingChats.has(chatId);
}

function isDisplayed(display: ButtonDisplay | undefined, chatId?: ChatId): boolean {
    if (chatId === undefined) return true;

    const isPrivate = typeof chatId === "number" && chatId > 0; // group ids are negative
    const isPublic = isPublicChat(chatId);
    const shownIn: Record<ButtonDisplay, boolean> = {
        everywhere: true,
        private: isPrivate,
        public: isPublic,
        groups: !isPrivate,
        nonpublic: !isPublic,
    };

    return shownIn[display ?? "everywhere"];
}

// The /start handler turns "cmd__a__b" back into "/cmd a b"; params that don't fit Telegram's start rules are dropped
function startParam(command: string, params: unknown): string {
    const parts: unknown[] = params === undefined ? [] : Array.isArray(params) ? params : [params];
    const isSimple = parts.every(p => typeof p === "string" || typeof p === "number");
    const full = [command, ...parts].join("__");
    if (isSimple && START_PARAM_REGEX.test(full)) return full;

    if (parts.length > 0) logger.warn(`Deeplink params dropped for /${command}: ${JSON.stringify(params)}`);
    return command;
}

function deepLinkUrl(command: string, params: unknown): string {
    return `t.me/${botConfig.name}?start=${startParam(command, params)}`;
}

export function InlineButton(
    text: string,
    command: string,
    { flags, params, vId, style, deeplink, display, disabled }: InlineButtonOptions = {}
): InlineButtonResult {
    const extras = { ...(style && { style }), ...(display && display !== "everywhere" && { display }) };

    // disabled is the button's type field, so it replaces callback_data/url
    if (disabled) return { text, disabled: {}, ...extras };

    if (deeplink === "always") return { text, url: deepLinkUrl(command, params), ...extras };

    // Explicit whitelist: only these short keys go over the wire, undefined ones are dropped
    const data: CallbackData = { cmd: command, fs: flags, vId, params };
    const callback_data = JSON.stringify(data);

    return {
        text,
        callback_data,
        ...extras,
        ...(deeplink === "public" && { deeplink }),
    };
}

function resolveButton({ deeplink, ...button }: InlineButtonResult, chatId?: ChatId): InlineKeyboardButton {
    delete button.display;

    if (deeplink !== "public" || !isPublicChat(chatId) || !button.callback_data) {
        // Checked at send time so builders like WikiPageButton can drop oversized buttons without noise
        if (button.callback_data && Buffer.byteLength(button.callback_data) > MAX_CALLBACK_DATA_BYTES)
            logger.warn(`callback_data over ${MAX_CALLBACK_DATA_BYTES} bytes: ${button.callback_data}`);

        return button;
    }

    const { cmd, params } = JSON.parse(button.callback_data) as CallbackData;
    return { text: button.text, url: deepLinkUrl(cmd as string, params), ...(button.style && { style: button.style }) };
}

// Applies display/deeplink for the chat the message actually goes to and strips them. A send path that skips
// this shows every button as a plain callback. Unknown chat: only strip. Never mutates input.
export function resolveKeyboard(keyboard: InlineButtonResult[][], chatId?: ChatId): InlineKeyboardButton[][] {
    return keyboard
        .map(row => row.filter(button => isDisplayed(button.display, chatId)).map(button => resolveButton(button, chatId)))
        .filter(row => row.length > 0);
}

export function InlineLinkButton(text: string, url: string) {
    return {
        text,
        url,
    };
}
