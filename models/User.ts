import { ChatId } from "node-telegram-bot-api";

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

    constructor({
        id,
        username,
        roles = "default",
        mac = null,
        birthday = null,
        autoinside = AutoInsideMode.Disabled,
        emoji = null,
        userid = null,
    }: User) {
        this.id = id;
        this.username = username;
        this.roles = roles;
        this.mac = mac;
        this.birthday = birthday;
        this.autoinside = autoinside;
        this.emoji = emoji;
        this.userid = userid;
    }
}

export default User;
