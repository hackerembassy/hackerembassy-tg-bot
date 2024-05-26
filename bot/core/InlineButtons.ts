import config from "config";
import { Message } from "node-telegram-bot-api";

import { BotConfig } from "../../config/schema";
import HackerEmbassyBot from "./HackerEmbassyBot";

const botConfig = config.get<BotConfig>("bot");
const AnnoyingChats = [botConfig.chats.main, botConfig.chats.offtopic];

export enum ButtonFlags {
    Simple = 0,
    Editing = 1 << 0, // 01
    Silent = 1 << 1, // 10
}

export function InlineButton(text: string, command?: string, flags?: ButtonFlags, options?: any) {
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

export function AnnoyingInlineButton(bot: HackerEmbassyBot, msg: Message, text: string, command: string, flags?: ButtonFlags) {
    return bot.context(msg).mode.forward || AnnoyingChats.includes(msg.chat.id)
        ? InlineDeepLinkButton(text, bot.Name!, command)
        : InlineButton(text, command, flags);
}
