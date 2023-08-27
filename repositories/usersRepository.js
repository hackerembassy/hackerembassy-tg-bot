// eslint-disable-next-line @typescript-eslint/no-unused-vars
const User = require("../models/User");
const { anyItemIsInList } = require("../utils/common");
const BaseRepository = require("./baseRepository");

class UserRepository extends BaseRepository {
    /**
     *  @returns {User[]}
     */
    getUsers() {
        let users = /** @type {User[]} */ (this.db.prepare("SELECT * FROM users").all());

        return users ? users.map(user => new User(user)) : null;
    }

    /**
     *  @param {string} username
     *  @param {string[]} roles
     *  @returns {boolean}
     */
    addUser(username, roles = ["default"]) {
        try {
            if (this.getUserByName(username) !== null) return false;
            let joinedRoles = roles.join("|");

            this.db.prepare("INSERT INTO users (username, roles) VALUES (?, ?)").run(username, joinedRoles);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     *  @param {string} username
     *  @param {string[]} roles
     *  @returns {boolean}
     */
    updateRoles(username, roles = ["default"]) {
        try {
            if (this.getUserByName(username) === null) return false;
            let joinedRoles = roles.join("|");

            this.db.prepare("UPDATE users SET roles = ? WHERE username = ?").run(joinedRoles, username);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     *  @param {string} cmd
     *  @returns {boolean}
     */
    testMACs(cmd) {
        const macRegex = /^([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})$/;
        return cmd.split(",").every(mac => macRegex.test(mac.trim()));
    }

    /**
     *  @returns {string[]}
     */
    getAllRegisteredMACs() {
        let registeredMacEntries = /** @type {{mac:string}[]} */ (
            this.db.prepare("SELECT mac FROM users where mac IS NOT NULL").all()
        );

        return registeredMacEntries.flatMap(macEntry => macEntry.mac.split("|"));
    }

    /**
     *  @param {string} username
     *  @param {string} macs
     *  @returns {boolean}
     */
    setMACs(username, macs = null) {
        try {
            const currentUser = this.getUserByName(username);
            if (currentUser === null && !this.addUser(username, ["default"])) return false;

            const newMacs = macs ? macs.split(",").map(mac => mac.toLowerCase().replaceAll("-", ":").trim()) : [];
            const existingRegisteredMacs = this.getAllRegisteredMACs();
            const existingOtherUsersMacs = currentUser
                ? existingRegisteredMacs.filter(mac => !currentUser.mac.split(",").includes(mac))
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

    /**
     *  @param {string} username
     *  @param {string} emoji
     *  @returns {boolean}
     */
    setEmoji(username, emoji = null) {
        try {
            if (this.getUserByName(username) === null && !this.addUser(username, ["default"])) return false;

            this.db.prepare("UPDATE users SET emoji = ? WHERE username = ?").run(emoji, username);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     *  @param {string} username
     *  @param {number|null} userid
     *  @returns {boolean}
     */
    setUserid(username, userid) {
        try {
            if (this.getUserByName(username) === null && !this.addUser(username, ["default"])) return false;

            this.db.prepare("UPDATE users SET userid = ? WHERE username = ?").run(userid, username);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     *  @param {string} username
     *  @param {boolean} value
     *  @returns {boolean}
     */
    setAutoinside(username, value) {
        try {
            let user = this.getUserByName(username);
            if ((user === null && !this.addUser(username, ["default"])) || (value && !user.mac)) return false;

            this.db.prepare("UPDATE users SET autoinside = ? WHERE username = ?").run(Number(value), username);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     *  @param {string} username
     *  @param {string} birthday
     *  @returns {boolean}
     */
    setBirthday(username, birthday = null) {
        try {
            if (this.getUserByName(username) === null && !this.addUser(username, ["default"])) return false;

            this.db.prepare("UPDATE users SET birthday = ? WHERE username = ?").run(birthday, username);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     *  @param {string} username
     *  @returns {boolean}
     */
    removeUser(username) {
        try {
            this.db.prepare("DELETE FROM users WHERE username = ?").run(username);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     *  @param {string} username
     *  @returns {User}
     */
    getUserByName(username) {
        try {
            /** @type {User} */
            let user = /** @type {User} */ (this.db.prepare("SELECT * FROM users WHERE username = ?").get(username));

            return user ? new User(user) : null;
        } catch (error) {
            this.logger.error(error);
            return null;
        }
    }

    /**
     *  @param {string} role
     *  @returns {User[]}
     */
    getUsersByRole(role) {
        try {
            /** @type {User[]} */
            let users = /** @type {User[]} */ (
                this.db.prepare("SELECT * FROM users WHERE roles LIKE ('%' || ? || '%')").all(role)
            );

            return users ? users.map(user => new User(user)) : null;
        } catch (error) {
            this.logger.error(error);
            return null;
        }
    }
}

module.exports = new UserRepository();
