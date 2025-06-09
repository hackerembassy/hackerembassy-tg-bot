import { NodeHtmlMarkdown } from "node-html-markdown";

import TelegramBot, { PhotoSize } from "node-telegram-bot-api";

import { User } from "@data/models";

import { ITelegramUser } from "./types";

export class OptionalRegExp extends RegExp {}

export function OptionalParam(paramregex: RegExp) {
    return new OptionalRegExp(`(?: ${paramregex.source})?`, paramregex.flags);
}

export function formatUsername(username: Optional<string>, mention = false, isApi = false): string {
    if (!username) return "[No username provided]";

    username = username.replace("@", "");

    if (isApi) return `@${username}`;

    if (mention) return `@${username}`.replaceAll("_", "\\_");
    else return `#[${username}#]#(t.me/${username}#)`;
}

export function tgUserLink(tgUser: ITelegramUser) {
    return `#[${tgUser.username ?? tgUser.first_name ?? tgUser.id}#]#(tg://user?id=${tgUser.id}#)`;
}

// TODO remove
export function userLink(user: Pick<User, "username" | "first_name" | "userid">) {
    return `#[${user.username ?? user.first_name ?? user.userid}#]#(tg://user?id=${user.userid}#)`;
}

export function effectiveName(user?: ITelegramUser | User) {
    return user ? (user.username ?? user.first_name ?? undefined) : undefined;
}

export function getMentions(msg: TelegramBot.Message) {
    return msg.entities?.filter(e => e.type === "text_mention").map(e => e.user) ?? [];
}

/**
 * Bot uses MarkdownV2 by default, because it's needed for almost every command.
 * But we still want to be able to use markdown special symbols as regular symbols in some cases.
 * To allow this we prefix these symbols with # when we need them to be used as markup.
 * @param message where functional markup symbols are escaped with #
 * @returns string where these are converted to a usual Markdownv2 format
 */
export function prepareMessageForMarkdown(message: string): string {
    return message
        .replaceAll(/((?<![\\|#])[_*[\]()~`>+\-=|{}.!])/g, "\\$1")
        .replaceAll(/#([_*[\]()~`>+\-=|{}.!])/g, "$1")
        .replaceAll(/#/g, "")
        .replaceAll("\\u0023", "\\#");
}

/**
 * @param text which can have html tags
 * @returns string in Markdownv2 format where all markdown tags are escaped with # symbol
 */
export function toEscapedTelegramMarkdown(text: string): string {
    return NodeHtmlMarkdown.translate(text, {
        useInlineLinks: false,
        strongDelimiter: "#*",
        emDelimiter: "#_",
    })
        .replaceAll(/https?:\/\/t\.me/g, "t.me")
        .replaceAll(/\[t\.me\/(.*?)\]/g, "[$1]")
        .replaceAll(/\[(.*?)\]\((.*?)\)/g, "#[$1#]#($2#)")
        .replaceAll(/%5F/g, "_");
}

export function stripCustomMarkup(text: string): string {
    return text.replaceAll(/#./g, "");
}

export function extractPhotoId(photo?: PhotoSize[], index: number = 1, backupIndex: number = 0): string | undefined {
    if (!photo || photo.length === 0) return undefined;

    return photo[index]?.file_id ?? photo[backupIndex]?.file_id;
}
