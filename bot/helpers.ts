import { NodeHtmlMarkdown } from "node-html-markdown";
import { Message } from "node-telegram-bot-api";

import { BotRole, ITelegramUser } from "../bot/core/types";
import User from "../models/User";
import UsersRepository from "../repositories/usersRepository";
import { CommandsMap } from "../resources/commands";
import { BotMessageContext } from "./core/types";
import { Flags } from "./handlers/service";

export function isPrivateMessage(msg: Message, context: BotMessageContext): boolean {
    return msg.chat.type === "private" && !context.mode.forward;
}

export function InlineButton(text: string, command?: string, flags?: Flags, options?: any) {
    return {
        text,
        callback_data: JSON.stringify({ cmd: command, fs: flags, ...options }),
    };
}

export function hasRole(username: Optional<string>, ...roles: string[]) {
    if (!username) return false;
    const userRoles = toRolesList(UsersRepository.getUserByName(username)?.roles);

    if (userRoles.length === 0) return false;

    const intersection = userRoles.filter(r => roles.includes(r));

    return intersection.length > 0;
}

export function toRolesList(roles: Optional<string>): BotRole[] {
    return roles ? (roles.split("|") as BotRole[]) : [];
}

export function getRoles(user: string | User | undefined) {
    if (!user) return [];

    if (user instanceof User) return toRolesList(user.roles);

    return toRolesList(UsersRepository.getUserByName(user)?.roles);
}

export function isMember(user: string | User): boolean {
    const userRoles: BotRole[] | string | undefined =
        user instanceof User ? toRolesList(user.roles) : UsersRepository.getUserByName(user)?.roles;

    return userRoles?.includes("member") === true;
}

export function getAvailableCommands(username?: string, role?: keyof typeof CommandsMap) {
    const userRoles = [...getRoles(username), "default"];

    if (role && userRoles.includes(role)) return CommandsMap[role];

    return Object.keys(CommandsMap)
        .filter(r => userRoles.includes(r as keyof typeof CommandsMap))
        .map(r => CommandsMap[r as keyof typeof CommandsMap])
        .join("");
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
 * @see HackerEmbassyBot.prepareMessageForMarkdown
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
