import config from "config";
import { Message } from "node-telegram-bot-api";

import { BotConfig } from "@config";

import HackerEmbassyBot from "./classes/HackerEmbassyBot";

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

export function InlineButton(text: string, command?: string, flags?: ButtonFlags, options?: object) {
    return {
        text,
        callback_data: JSON.stringify({ cmd: command, fs: flags, ...options }),
    };
}

export function InlineLinkButton(text: string, url: string) {
    return {
        text,
        url,
    };
}

export function InlineDeepLinkButton(text: string, botName: string, cmd: string) {
    return {
        text,
        url: `t.me/${botName}?start=${cmd}`,
    };
}

export function AnnoyingInlineButton(
    bot: HackerEmbassyBot,
    msg: Message,
    text: string,
    command: string,
    flags?: ButtonFlags,
    options?: object
) {
    return bot.context(msg).mode.forward || AnnoyingChats.has(msg.chat.id)
        ? InlineDeepLinkButton(text, bot.name, command)
        : InlineButton(text, command, flags, options);
}
