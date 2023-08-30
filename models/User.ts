import { ChatId } from "node-telegram-bot-api";

import { BotRole } from "../bot/HackerEmbassyBot";

class User {
    userid: ChatId;
    id: number;
    username: string;
    roles: string;
    mac: string;
    birthday: string;
    autoinside: number;
    emoji: string;

    constructor({ id, username, roles = "default", mac = null, birthday = null, autoinside = 0, emoji = null, userid = null }) {
        this.id = id;
        this.username = username;
        this.roles = roles;
        this.mac = mac;
        this.birthday = birthday;
        this.autoinside = autoinside;
        this.emoji = emoji;
        this.userid = userid;
    }

    get rolesList(): BotRole[] {
        return this.roles.split("|") as BotRole[];
    }
}

export default User;
