import { NodeHtmlMarkdown } from "node-html-markdown";
import { User as TgUser } from "node-telegram-bot-api";

import { UserRole } from "@data/types";
import { User } from "@data/models";

import { ITelegramUser } from "./types";

export class OptionalRegExp extends RegExp {}

export function OptionalParam(paramregex: RegExp) {
    return new OptionalRegExp(`(?: ${paramregex.source})?`, paramregex.flags);
}

export function formatUsername(username: Optional<string>, mode = { mention: false }, isApi = false): string {
    if (!username) return "[No username provided]";

    username = username.replace("@", "");

    if (isApi) return `@${username}`;

    if (mode.mention) return `@${username}`.replaceAll("_", "\\_");
    else return `#[${username}#]#(t.me/${username}#)`;
}

export function userLink(user: ITelegramUser) {
    return `#[${user.username ?? user.first_name ?? user.id}#]#(tg://user?id=${user.id}#)`;
}

export function effectiveName(user?: TgUser) {
    return user ? user.username ?? user.first_name : undefined;
}

// TODO

export function hasRole(user: User, ...roles: UserRole[]) {
    return user.roles?.length !== 0 ? splitRoles(user).filter(r => roles.includes(r)).length > 0 : false;
}

export function splitRoles(user: User) {
    return user.roles?.split("|") as UserRole[];
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
