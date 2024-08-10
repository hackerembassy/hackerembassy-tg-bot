import TelegramBot from "node-telegram-bot-api";

import { User } from "@data/models";
import { DefaultUser } from "@data/seed";
import usersRepository from "@repositories/users";

import logger from "./logger";

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

        if (dbuser.userid === DefaultUser.userid) {
            logger.info(`User [${tgUser.id}]${tgUser.username} was not found in the database. Adding...`);

            usersRepository.addUser(tgUser.id, tgUser.username, ["default"]);
        } else if (dbuser.username !== tgUser.username || dbuser.first_name !== tgUser.first_name) {
            logger.info(
                `User [${tgUser.id}]${dbuser.username} changed username/name to ${tgUser.username}/${tgUser.first_name}. Updating...`
            );

            usersRepository.updateUser(dbuser.userid, { ...dbuser, username: tgUser.username, first_name: tgUser.first_name });
        }

        return dbuser;
    }
}

export default new UserService();
