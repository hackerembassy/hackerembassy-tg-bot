import { ChatId } from "node-telegram-bot-api";

export type UserRole = "admin" | "member" | "accountant" | "trusted" | "default" | "restricted";

export const enum AutoInsideMode {
    Disabled = 0,
    Enabled = 1,
    Ghost = 2,
}

export const DefaultUser: ExcludeMethods<User> = {
    id: 0,
    username: null,
    roles: "default",
    mac: null,
    birthday: null,
    autoinside: AutoInsideMode.Disabled,
    emoji: null,
    userid: 0,
    language: null,
};

class User {
    readonly id: number;
    userid: ChatId;
    username: Nullable<string>;
    roles: string;
    mac: Nullable<string>;
    birthday: Nullable<string>;
    autoinside: AutoInsideMode;
    emoji: Nullable<string>;
    language: Nullable<string>;

    constructor({ id, username, roles, mac, birthday, autoinside, emoji, userid, language } = DefaultUser) {
        this.id = id;
        this.username = username;
        this.roles = roles;
        this.mac = mac;
        this.birthday = birthday;
        this.autoinside = autoinside;
        this.emoji = emoji;
        this.userid = userid;
        this.language = language;
    }

    hasRole(...roles: UserRole[]) {
        return this.roles.length !== 0 ? this.splitRoles().filter(r => roles.includes(r)).length > 0 : false;
    }

    splitRoles() {
        return this.roles.split("|") as UserRole[];
    }

    userLink() {
        return `#[${this.username}#]#(tg://user?id=${this.userid}#)`;
    }
}

export default User;
