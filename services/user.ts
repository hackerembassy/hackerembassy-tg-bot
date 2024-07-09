import TelegramBot from "node-telegram-bot-api";

import User, { DefaultUser } from "@models/User";
import usersRepository from "@repositories/users";

import logger from "./logger";

class UserService {
    public verifyUser(tgUser: { id: number; username?: string }, language: string) {
        const user = usersRepository.getByUserId(tgUser.id);

        if (!user) throw new Error(`Restricted user ${tgUser.username} with id ${tgUser.id} should exist`);

        if (!user.roles.includes("restricted")) {
            logger.info(`User [${tgUser.id}](${tgUser.username}) was already verified`);
            return true;
        }

        logger.info(`User [${tgUser.id}](${tgUser.username}) passed the verification`);

        return usersRepository.updateUser(new User({ ...user, roles: "default", language }));
    }

    public prepareUser(user: TelegramBot.User): User {
        const dbuser = usersRepository.getByUserId(user.id) ?? new User({ ...DefaultUser });

        if (dbuser.id === DefaultUser.id) {
            logger.info(`User [${user.id}]${user.username} was not found in the database. Adding...`);

            usersRepository.addUser(user.username ?? undefined, ["default"], user.id);
        } else if (user.username && dbuser.username !== user.username) {
            logger.info(`User [${user.id}]${dbuser.username} changed username to ${user.username}. Updating...`);

            usersRepository.updateUser(new User({ ...dbuser, username: user.username }));
        }

        return dbuser;
    }
}

export default new UserService();
