import { ChatId } from "node-telegram-bot-api";

import User, { AutoInsideMode } from "@models/User";
import { anyItemIsInList } from "@utils/filters";

import BaseRepository from "./base";

class UserRepository extends BaseRepository {
    getUsers(): User[] {
        const users = this.db.prepare("SELECT * FROM users").all() as User[];

        return users.map(user => new User(user));
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

    getUsersByRole(role: string): User[] {
        try {
            const users = this.db.prepare("SELECT * FROM users WHERE roles LIKE ('%' || ? || '%')").all(role);

            return users.map(user => new User(user as User));
        } catch (error) {
            this.logger.error(error);
            return [];
        }
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
    updateRoles(userid: ChatId, roles: string[] = ["default"]): boolean {
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

    setMACs(userid: number | ChatId, macs: Nullable<string> = null): boolean {
        try {
            const currentUser = this.getByUserId(userid);
            if (currentUser === null) return false;

            const newMacs = macs ? macs.split(",").map(mac => mac.toLowerCase().replaceAll("-", ":").trim()) : [];
            const existingRegisteredMacs = this.getAllRegisteredMACs();
            const existingOtherUsersMacs = existingRegisteredMacs.filter(mac => !currentUser.mac?.split(",").includes(mac));

            const newMacsString = newMacs.join(",");

            if (anyItemIsInList(newMacs, existingOtherUsersMacs))
                throw Error(`Mac's [${newMacsString}] already exist in database`);

            this.db.prepare("UPDATE users SET mac = ? WHERE userid = ?").run(newMacsString, userid);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    setEmoji(userid: ChatId, emoji: Nullable<string> = null): boolean {
        try {
            if (this.getByUserId(userid) === null) return false;

            this.db.prepare("UPDATE users SET emoji = ? WHERE userid = ?").run(emoji, userid);

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

    setAutoinside(userid: ChatId, mode: AutoInsideMode): boolean {
        try {
            const user = this.getByUserId(userid);
            if (user === null || (mode === AutoInsideMode.Disabled && !user.mac)) return false;

            this.db.prepare("UPDATE users SET autoinside = ? WHERE userid = ?").run(Number(mode), userid);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    setBirthday(userid: ChatId, birthday: Nullable<string> = null): boolean {
        try {
            if (this.getByUserId(userid) === null) return false;

            this.db.prepare("UPDATE users SET birthday = ? WHERE userid = ?").run(birthday, userid);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    removeUserByUsername(username: string): boolean {
        try {
            this.db.prepare("DELETE FROM users WHERE LOWER(username) = ?").run(username.toLowerCase());

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    removeUserById(userid: ChatId): boolean {
        try {
            this.db.prepare("DELETE FROM users WHERE userid = ?").run(userid);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }
}

export default new UserRepository();
