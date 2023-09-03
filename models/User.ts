import { ChatId } from "node-telegram-bot-api";

class User {
    readonly id: number;
    userid: ChatId | null;
    username: string | null;
    roles: string;
    mac: string | null;
    birthday: string | null;
    autoinside: boolean;
    emoji: string | null;

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
