import { BotRole } from "../bot/HackerEmbassyBot";
import User from "../models/User";
import UsersRepository from "../repositories/usersRepository";
import { AccountantCommandsList, AdminCommandsList, GeneralCommandsList, MemberCommandsList } from "../resources/commands";

export function hasRole(username: Optional<string>, ...roles: string[]) {
    if (!username) return false;
    const userRoles = toRolesList(UsersRepository.getUserByName(username)?.roles);

    if (!userRoles) return false;

    const intersection = userRoles.filter(r => roles.includes(r));

    return intersection.length > 0;
}

export function toRolesList(roles: Optional<string>): BotRole[] {
    return roles ? (roles.split("|") as BotRole[]) : [];
}

export function getRoles(user: string | User) {
    if (user instanceof User) return toRolesList(user.roles);

    return toRolesList(UsersRepository.getUserByName(user)?.roles);
}

export function isMember(user: string | User): boolean {
    const userRoles: BotRole[] | string | undefined =
        user instanceof User ? toRolesList(user?.roles) : UsersRepository.getUserByName(user)?.roles;

    return userRoles?.includes("member") === true;
}

export function getAvailableCommands(username: Optional<string>) {
    let availableCommands = GeneralCommandsList;

    const userRoles = username ? UsersRepository.getUserByName(username)?.roles : undefined;
    if (!userRoles) return availableCommands;

    if (userRoles.includes("member")) availableCommands += MemberCommandsList;
    if (userRoles.includes("admin")) availableCommands += AdminCommandsList;
    if (userRoles.includes("accountant")) availableCommands += AccountantCommandsList;

    return availableCommands;
}

export function formatUsername(username: Optional<string>, mode = { mention: false }, isApi = false): string {
    if (!username) return "[No username provided]";

    username = username.replace("@", "");

    if (isApi) return `@${username}`;

    if (mode.mention) return `@${username}`.replaceAll("_", "\\_");
    else return `#[${username}#]#(t.me/${username}#)`;
}
