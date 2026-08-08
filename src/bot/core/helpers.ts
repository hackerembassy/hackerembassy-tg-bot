import { Message, PhotoSize } from "node-telegram-bot-api";

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

    return mention ? `@${username}`.replaceAll("_", "\\_") : `#[${username}#]#(t.me/${username}#)`;
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

export function getMentions(msg: Message) {
    return msg.entities?.filter(e => e.type === "text_mention").map(e => e.user) ?? [];
}

export function formatDateTime(text: string, date: Date): string {
    const unixTime = Math.floor(date.getTime() / 1000);

    return `#!#[${text}#]#(tg://time?unix#=${unixTime}#)`;
}

export function formatMonospaced(text: string): string {
    return `#\`${text}#\``;
}

export function extractPhotoId(photo?: PhotoSize[], index: number = 1, backupIndex: number = 0): string | undefined {
    if (!photo || photo.length === 0) return;

    return photo[index]?.file_id ?? photo[backupIndex]?.file_id;
}
