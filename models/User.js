/**
 * @typedef {import("../bot/bot").BotRole} BotRole
 */

class User {
    /**
     * Represents a telegram user in the bot.
     * @constructor
     * @param {object} params - The parameters for creating a user.
     * @param {number} params.id - The unique ID of the user.
     * @param {string} params.username - The username of the user.
     * @param {string} params.roles - The roles assigned to the user (default if not provided).
     * @param {string|null} params.mac - The MAC address of the user's device, if available.
     * @param {string} params.birthday - The user's birthday as a Date object, or null if not provided.
     * @param {number} params.autoinside - A flag indicating whether the user is enrolled in automatic insider deals (0 or 1).
     * @param {string|null} params.emoji - The user's favorite emoji, if any.
     * @param {number|null} params.userid - Telegram user ID of the user, if any.
     */
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

    /**
     * Get the user's roles as an array.
     * @returns {BotRole[]}
     */
    get rolesList() {
        return /** @type {BotRole[]} */ (this.roles.split("|"));
    }
}

module.exports = User;
