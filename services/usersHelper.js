const Commands = require("../resources/commands");
const UsersRepository = require("../repositories/usersRepository");
// eslint-disable-next-line no-unused-vars
const User = require("../models/User");

/**
 * @typedef {import("../bot/bot").BotRole} BotRole
 */

/**
 * @param {string} username
 * @param {BotRole[]} roles
 * @returns {boolean}
 */
function hasRole(username, ...roles) {
    let userRoles = UsersRepository.getUserByName(username)?.rolesList;

    if (!userRoles) return false;

    let intersection = userRoles.filter(r => roles.includes(r));

    return intersection.length > 0;
}

/**
 * @param {string | User} user
 * @returns {string[]}
 */
function getRoles(user) {
    if (user instanceof User) return user.rolesList;

    return UsersRepository.getUserByName(user)?.rolesList ?? [];
}

/**
 * @param {string | User} user
 * @returns {boolean}
 */
function isMember(user) {
    let userRoles = user instanceof User ? user?.rolesList : UsersRepository.getUserByName(user)?.roles;
    return userRoles.includes("member");
}

/**
 * @param {string} username
 * @returns {string}
 */
function getAvailableCommands(username) {
    let availableCommands = Commands.GeneralCommandsList;
    let userRoles = UsersRepository.getUserByName(username)?.roles;

    if (!userRoles) return availableCommands;

    if (userRoles.includes("member")) availableCommands += Commands.MemberCommandsList;
    if (userRoles.includes("admin")) availableCommands += Commands.AdminCommandsList;
    if (userRoles.includes("accountant")) availableCommands += Commands.AccountantCommandsList;

    return availableCommands;
}

/**
 * @param {string} username
 * @param {{ mention: boolean; }} mode
 * @param {boolean} isApi
 */
function formatUsername(username, mode = { mention: false }, isApi = false) {
    username = username.replace("@", "");

    if (isApi) return `@${username}`;

    if (mode.mention) return `@${username}`.replaceAll("_", "\\_");
    else return `#[${username}#]#(t.me/${username}#)`;
}

module.exports = { getAvailableCommands, hasRole, isMember, getRoles, formatUsername };
