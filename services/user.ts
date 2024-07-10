import TelegramBot from "node-telegram-bot-api";

import { User } from "@data/models";

import { AutoInsideMode } from "@data/types";

import usersRepository from "@repositories/users";

import logger from "./logger";

export const DefaultUser = {
    id: 0,
    username: null,
    firstname: null,
    lastname: null,
    roles: "default",
    mac: null,
    birthday: null,
    autoinside: AutoInsideMode.Disabled,
    emoji: null,
    userid: 0,
    language: null,
};

export const HassUser = {
    id: 0,
    username: "hass",
    firstname: null,
    lastname: null,
    roles: "admin",
    mac: null,
    birthday: null,
    autoinside: AutoInsideMode.Disabled,
    emoji: null,
    userid: 1,
    language: null,
};

class UserService {
    public verifyUser(tgUser: { id: number; username?: string }, language: string) {
        const user = usersRepository.getUserByUserId(tgUser.id);

        if (!user) throw new Error(`Restricted user ${tgUser.username} with id ${tgUser.id} should exist`);

        if (!user.roles?.includes("restricted")) {
            logger.info(`User [${tgUser.id}](${tgUser.username}) was already verified`);
            return true;
        }

        logger.info(`User [${tgUser.id}](${tgUser.username}) passed the verification`);

        return usersRepository.updateUser(user.userid, { ...user, roles: "default", language });
    }

    public prepareUser(tgUser: TelegramBot.User): User {
        const dbuser = usersRepository.getUserByUserId(tgUser.id) ?? { ...DefaultUser };

        if (dbuser.id === DefaultUser.id) {
            logger.info(`User [${tgUser.id}]${tgUser.username} was not found in the database. Adding...`);

            usersRepository.addUser(tgUser.id, tgUser.username, ["default"]);
        } else if (tgUser.username && dbuser.username !== tgUser.username) {
            logger.info(`User [${tgUser.id}]${dbuser.username} changed username to ${tgUser.username}. Updating...`);

            usersRepository.updateUser(dbuser.userid, { ...dbuser, username: tgUser.username });
        }

        return dbuser;
    }
}

export default new UserService();
