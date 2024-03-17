import { ChatId } from "node-telegram-bot-api";

import User, { AutoInsideMode } from "../models/User";
import { anyItemIsInList } from "../utils/common";
import BaseRepository from "./baseRepository";

class UserRepository extends BaseRepository {
    getUsers(): User[] {
        const users = this.db.prepare("SELECT * FROM users").all() as User[];

        return users.map(user => new User(user));
    }

    getAutoinsideUsers(): User[] {
        const users = this.db
            .prepare("SELECT * FROM users WHERE autoinside > 0 AND username IS NOT NULL AND mac IS NOT NULL")
            .all() as User[];

        return users.map(user => new User(user));
    }

    addUser(username?: string, roles: string[] = ["default"], userid?: number): boolean {
        try {
            // TODO remove username checking when ready
            if (username === undefined && userid === undefined) return false;

            if ((userid && this.getByUserId(userid) !== null) || (username && this.getUserByName(username) !== null))
                return false;

            const joinedRoles = roles.join("|");

            this.db
                .prepare("INSERT INTO users (username, roles, userid) VALUES (?, ?, ?)")
                .run(username, joinedRoles, userid ?? null);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    updateUser(user: User): boolean {
        try {
            this.db
                .prepare(
                    "UPDATE users SET username = ?, roles = ?, userid = ?, mac = ?, birthday = ?, autoinside = ?, emoji = ?, language = ? WHERE id = ?"
                )
                .run(
                    user.username,
                    user.roles,
                    user.userid,
                    user.mac,
                    user.birthday,
                    user.autoinside,
                    user.emoji,
                    user.language,
                    user.id
                );

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    // TODO rewrite below using only updateUser
    updateRoles(username: string, roles: string[] = ["default"]): boolean {
        try {
            if (this.getUserByName(username) === null) return false;
            const joinedRoles = roles.join("|");

            this.db.prepare("UPDATE users SET roles = ? WHERE LOWER(username) = ?").run(joinedRoles, username.toLowerCase());

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    updateRolesById(userid: number, roles: string[] = ["default"]): boolean {
        try {
            if (this.getByUserId(userid) === null) return false;
            const joinedRoles = roles.join("|");

            this.db.prepare("UPDATE users SET roles = ? WHERE userid = ?").run(joinedRoles, userid);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    testMACs(cmd: string): boolean {
        const macRegex = /^([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})$/;
        return cmd.split(",").every(mac => macRegex.test(mac.trim()));
    }

    getAllRegisteredMACs(): string[] {
        type macEntry = { mac: string };

        const registeredMacEntries = this.db.prepare("SELECT mac FROM users where mac IS NOT NULL").all() as macEntry[];

        return registeredMacEntries.flatMap(macEntry => macEntry.mac.split("|"));
    }

    setMACs(username: string, macs: Nullable<string> = null): boolean {
        try {
            const currentUser = this.getUserByName(username);
            if (currentUser === null && !this.addUser(username, ["default"])) return false;

            const newMacs = macs ? macs.split(",").map(mac => mac.toLowerCase().replaceAll("-", ":").trim()) : [];
            const existingRegisteredMacs = this.getAllRegisteredMACs();
            const existingOtherUsersMacs = currentUser
                ? existingRegisteredMacs.filter(mac => !currentUser.mac?.split(",").includes(mac))
                : existingRegisteredMacs;
            const newMacsString = newMacs.join(",");

            if (anyItemIsInList(newMacs, existingOtherUsersMacs))
                throw Error(`Mac's [${newMacsString}] already exist in database`);

            this.db.prepare("UPDATE users SET mac = ? WHERE LOWER(username) = ?").run(newMacsString, username.toLowerCase());

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    setEmoji(username: string, emoji: Nullable<string> = null): boolean {
        try {
            if (this.getUserByName(username) === null && !this.addUser(username, ["default"])) return false;

            this.db.prepare("UPDATE users SET emoji = ? WHERE LOWER(username) = ?").run(emoji, username.toLowerCase());

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    setUserid(username: string, userid: Nullable<number>): boolean {
        try {
            if (this.getUserByName(username) === null && !this.addUser(username, ["default"])) return false;

            this.db.prepare("UPDATE users SET userid = ? WHERE LOWER(username) = ?").run(userid, username.toLowerCase());

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    setAutoinside(username: string, mode: AutoInsideMode): boolean {
        try {
            const user = this.getUserByName(username);
            if ((user === null && !this.addUser(username, ["default"])) || (mode === AutoInsideMode.Disabled && !user?.mac))
                return false;

            this.db
                .prepare("UPDATE users SET autoinside = ? WHERE LOWER(username) = ?")
                .run(Number(mode), username.toLowerCase());

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    setBirthday(username: string, birthday: Nullable<string> = null): boolean {
        try {
            if (this.getUserByName(username) === null && !this.addUser(username, ["default"])) return false;

            this.db.prepare("UPDATE users SET birthday = ? WHERE LOWER(username) = ?").run(birthday, username.toLowerCase());

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    removeUser(username: string): boolean {
        try {
            this.db.prepare("DELETE FROM users WHERE LOWER(username) = ?").run(username.toLowerCase());

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    removeUserById(userid: number): boolean {
        try {
            this.db.prepare("DELETE FROM users WHERE userid = ?").run(userid);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    getUserByName(username: string): Nullable<User> {
        try {
            const user = this.db.prepare("SELECT * FROM users WHERE LOWER(username) = ?").get(username.toLowerCase());

            return user ? new User(user as User) : null;
        } catch (error) {
            this.logger.error(error);
            return null;
        }
    }

    getByUserId(userid: number | ChatId): Nullable<User> {
        try {
            const user = this.db.prepare("SELECT * FROM users WHERE userid = ?").get(userid);

            return user ? new User(user as User) : null;
        } catch (error) {
            this.logger.error(error);
            return null;
        }
    }

    getUsersByRole(role: string): Nullable<User[]> {
        try {
            const users: User[] = this.db.prepare("SELECT * FROM users WHERE roles LIKE ('%' || ? || '%')").all(role) as User[];

            return users;
        } catch (error) {
            this.logger.error(error);
            return null;
        }
    }
}

export default new UserRepository();
