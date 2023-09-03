import User from "../models/User";
import { anyItemIsInList } from "../utils/common";
import BaseRepository from "./baseRepository";

class UserRepository extends BaseRepository {
    getUsers(): User[] | null {
        const users = this.db.prepare("SELECT * FROM users").all();

        return users.filter(user => user).map(user => new User(user as User));
    }

    addUser(username: string, roles: string[] = ["default"]): boolean {
        try {
            if (this.getUserByName(username) !== null) return false;
            const joinedRoles = roles.join("|");

            this.db.prepare("INSERT INTO users (username, roles) VALUES (?, ?)").run(username, joinedRoles);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    updateRoles(username: string, roles: string[] = ["default"]): boolean {
        try {
            if (this.getUserByName(username) === null) return false;
            const joinedRoles = roles.join("|");

            this.db.prepare("UPDATE users SET roles = ? WHERE username = ?").run(joinedRoles, username);

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

    setMACs(username: string, macs: string | null = null): boolean {
        try {
            const currentUser = this.getUserByName(username);
            if (currentUser === null && !this.addUser(username, ["default"])) return false;

            const newMacs = macs ? macs.split(",").map(mac => mac.toLowerCase().replaceAll("-", ":").trim()) : [];
            const existingRegisteredMacs = this.getAllRegisteredMACs();
            const existingOtherUsersMacs = currentUser
                ? existingRegisteredMacs.filter(mac => !currentUser?.mac?.split(",").includes(mac))
                : existingRegisteredMacs;
            const newMacsString = newMacs?.join(",") ?? null;

            if (anyItemIsInList(newMacs, existingOtherUsersMacs))
                throw Error(`Mac's [${newMacsString}] already exist in database`);

            this.db.prepare("UPDATE users SET mac = ? WHERE username = ?").run(newMacsString, username);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    setEmoji(username: string, emoji: string | null = null): boolean {
        try {
            if (this.getUserByName(username) === null && !this.addUser(username, ["default"])) return false;

            this.db.prepare("UPDATE users SET emoji = ? WHERE username = ?").run(emoji, username);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    setUserid(username: string, userid: number | null): boolean {
        try {
            if (this.getUserByName(username) === null && !this.addUser(username, ["default"])) return false;

            this.db.prepare("UPDATE users SET userid = ? WHERE username = ?").run(userid, username);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    setAutoinside(username: string, value: boolean): boolean {
        try {
            const user = this.getUserByName(username);
            if ((user === null && !this.addUser(username, ["default"])) || (value && !user?.mac)) return false;

            this.db.prepare("UPDATE users SET autoinside = ? WHERE username = ?").run(Number(value), username);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    setBirthday(username: string, birthday: string | null = null): boolean {
        try {
            if (this.getUserByName(username) === null && !this.addUser(username, ["default"])) return false;

            this.db.prepare("UPDATE users SET birthday = ? WHERE username = ?").run(birthday, username);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    removeUser(username: string): boolean {
        try {
            this.db.prepare("DELETE FROM users WHERE username = ?").run(username);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    getUserByName(username: string): User | null {
        try {
            const user = this.db.prepare("SELECT * FROM users WHERE username = ?").get(username);

            return user ? new User(user as User) : null;
        } catch (error) {
            this.logger.error(error);
            return null;
        }
    }

    getUsersByRole(role: string): User[] | null {
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
