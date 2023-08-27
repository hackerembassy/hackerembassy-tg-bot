import { GeneralCommandsList, MemberCommandsList, AdminCommandsList, AccountantCommandsList } from "../resources/commands";
import UsersRepository from "../repositories/usersRepository";
import User from "../models/User";

export function hasRole(username, ...roles) {
    const userRoles = UsersRepository.getUserByName(username)?.rolesList;

    if (!userRoles) return false;

    const intersection = userRoles.filter(r => roles.includes(r));

    return intersection.length > 0;
}

export function getRoles(user) {
    if (user instanceof User) return user.rolesList;

    return UsersRepository.getUserByName(user)?.rolesList ?? [];
}

export function isMember(user) {
    const userRoles = user instanceof User ? user?.rolesList : UsersRepository.getUserByName(user)?.roles;
    return userRoles.includes("member");
}

export function getAvailableCommands(username) {
    let availableCommands = GeneralCommandsList;
    const userRoles = UsersRepository.getUserByName(username)?.roles;

    if (!userRoles) return availableCommands;

    if (userRoles.includes("member")) availableCommands += MemberCommandsList;
    if (userRoles.includes("admin")) availableCommands += AdminCommandsList;
    if (userRoles.includes("accountant")) availableCommands += AccountantCommandsList;

    return availableCommands;
}

export function formatUsername(username, mode = { mention: false }, isApi = false) {
    username = username.replace("@", "");

    if (isApi) return `@${username}`;

    if (mode.mention) return `@${username}`.replaceAll("_", "\\_");
    else return `#[${username}#]#(t.me/${username}#)`;
}
