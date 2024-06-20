import { ChatId } from "node-telegram-bot-api";

export type UserRole = "admin" | "member" | "accountant" | "trusted" | "default" | "restricted";

export const enum AutoInsideMode {
    Disabled = 0,
    Enabled = 1,
    Ghost = 2,
}

class User {
    readonly id: number;
    userid: Nullable<ChatId>;
    username: Nullable<string>;
    roles: string;
    mac: Nullable<string>;
    birthday: Nullable<string>;
    autoinside: AutoInsideMode;
    emoji: Nullable<string>;
    language: Nullable<string>;

    constructor({
        id,
        username,
        roles = "default",
        mac = null,
        birthday = null,
        autoinside = AutoInsideMode.Disabled,
        emoji = null,
        userid = null,
        language = "ru",
    }: ExcludeMethods<User>) {
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
}

export default User;
