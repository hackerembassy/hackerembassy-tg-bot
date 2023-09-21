import { ChatId } from "node-telegram-bot-api";

class User {
    readonly id: number;
    userid: Nullable<ChatId>;
    username: Nullable<string>;
    roles: string;
    mac: Nullable<string>;
    birthday: Nullable<string>;
    autoinside: boolean;
    emoji: Nullable<string>;

    constructor({
        id,
        username,
        roles = "default",
        mac = null,
        birthday = null,
        autoinside = false,
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
