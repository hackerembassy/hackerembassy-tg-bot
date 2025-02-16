import TelegramBot from "node-telegram-bot-api";

import { UserRole, UserStateChangeType, UserStateType } from "@data/types";
import { User, UserState, UserStateEx } from "@data/models";
import { DefaultUser } from "@data/seed";

import statusRepository from "@repositories/status";
import usersRepository from "@repositories/users";

import logger from "@services/common/logger";
import { convertToElapsedObject, ElapsedTimeObject, isToday, MONTH } from "@utils/date";

import { spaceService } from "./space";

// Types
export type UserVisit = { user: User; usertime: ElapsedTimeObject };

// Filters
function filterPeopleInside(userState: UserState): boolean {
    return userState.status === (UserStateType.Inside as number);
}

function filterAllPeopleInside(userState: UserState): boolean {
    return userState.status === (UserStateType.Inside as number) || userState.status === (UserStateType.InsideSecret as number);
}

function filterPeopleGoing(userState: UserState): boolean {
    return userState.status === (UserStateType.Going as number) && isToday(new Date(userState.date));
}

// helper functions
export function splitRoles(user: User) {
    return user.roles?.split("|") as UserRole[];
}

export function hasRole(user: User, ...roles: UserRole[]) {
    return user.roles?.length !== 0 ? splitRoles(user).filter(r => roles.includes(r)).length > 0 : false;
}

export function isBanned(user: User) {
    return user.roles?.includes("banned");
}

// Classes
class UserService {
    private lastUserStateCache: Map<number, UserStateEx> = new Map();

    // Public methods
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

    public getUser(identifier: number | string) {
        return typeof identifier === "string"
            ? usersRepository.getUserByName(identifier)
            : usersRepository.getUserByUserId(identifier);
    }

    public saveUser(user: User) {
        this.refreshCachedUser(user);
        return usersRepository.updateUser(user.userid, user);
    }

    public getPeopleInside(includeSecret = false): UserStateEx[] {
        return this.getRecentUserStates().filter(includeSecret ? filterAllPeopleInside : filterPeopleInside);
    }

    public getPeopleGoing() {
        return this.getRecentUserStates().filter(filterPeopleGoing);
    }

    public letIn(user: User, changeType = UserStateChangeType.Manual, from: Date = new Date(), until?: Date, ghost = false) {
        const allowedToEnter =
            changeType === UserStateChangeType.Auto ||
            changeType === UserStateChangeType.Force ||
            spaceService.getState().open ||
            user.roles?.includes("member");

        if (!allowedToEnter) return false;

        this.pushPeopleState({
            status: ghost ? UserStateType.InsideSecret : UserStateType.Inside,
            date: from.getTime(),
            until: until?.getTime() ?? null,
            user_id: user.userid,
            type: changeType,
            note: null,
            user,
        });

        return true;
    }

    public letOut(user: User, changeType = UserStateChangeType.Manual, date: Date = new Date()) {
        this.pushPeopleState({
            status: UserStateType.Outside,
            date: date.getTime(),
            until: null,
            user_id: user.userid,
            type: changeType,
            note: null,
            user,
        });

        return true;
    }

    public setGoingState(user: User, isGoing: boolean, note?: string) {
        this.pushPeopleState({
            status: isGoing ? UserStateType.Going : UserStateType.Outside,
            date: new Date().getTime(),
            until: null,
            user_id: user.userid,
            type: UserStateChangeType.Manual,
            note: note ?? null,
            user,
        });
    }

    public evictPeople(): void {
        const date = Date.now();
        const peopleInside = this.getPeopleInside();

        for (const userstate of peopleInside) {
            this.pushPeopleState({
                status: UserStateType.Outside,
                date: date,
                until: null,
                user_id: userstate.user_id,
                type: UserStateChangeType.Evicted,
                note: null,
                user: userstate.user,
            });
        }
    }

    public getAllVisits(fromDate: Date, toDate: Date): UserVisit[] {
        const allUserStates = statusRepository.getAllUserStates(fromDate.getTime(), toDate.getTime());
        const userStateMap = new Map<number, UserStateEx[]>();
        const usersVisits: UserVisit[] = [];

        for (const userState of allUserStates) {
            if (!userStateMap.has(userState.user_id)) userStateMap.set(userState.user_id, []);

            userStateMap.get(userState.user_id)?.push(userState);
        }

        for (const userStates of userStateMap.values()) {
            usersVisits.push({
                user: userStates[0].user,
                usertime: this.getUserTotalTimeInternal(userStates),
            });
        }

        return usersVisits
            .filter(ut => ut.usertime.totalSeconds > 59)
            .sort((a, b) => (a.usertime.totalSeconds > b.usertime.totalSeconds ? -1 : 1));
    }

    public getUserTotalTime(user: User): ElapsedTimeObject {
        const userStates = statusRepository.getUserStates(user.userid);

        return this.getUserTotalTimeInternal(userStates);
    }

    private getUserTotalTimeInternal(userStates: UserState[]): ElapsedTimeObject {
        let totalTime = 0;
        let startTime = -1;

        userStates.sort((a, b) => (a.date > b.date ? 1 : -1));

        for (const userState of userStates) {
            if (startTime === -1 && userState.status === (UserStateType.Inside as number)) {
                startTime = Number(userState.date);
            } else if (
                startTime !== -1 &&
                (userState.status === (UserStateType.Outside as number) || userState.status === (UserStateType.Going as number))
            ) {
                totalTime += Number(userState.date) - startTime;
                startTime = -1;
            }
        }

        return convertToElapsedObject(totalTime / 1000);
    }

    // Private methods
    private getRecentUserStates() {
        if (this.lastUserStateCache.size === 0) {
            const allUserStates = statusRepository.getAllUserStates(new Date().getTime() - MONTH);

            for (const userstate of allUserStates) {
                if (this.lastUserStateCache.has(userstate.user_id)) continue;

                this.lastUserStateCache.set(userstate.user_id, userstate);
            }
        }

        return Array.from(this.lastUserStateCache.values());
    }

    private refreshCachedUser(user: User): void {
        const userState = this.lastUserStateCache.get(user.userid);

        if (!userState) return;

        this.lastUserStateCache.set(user.userid, { ...userState, user });
    }

    private pushPeopleState(state: Omit<UserStateEx, "id">): void {
        const newState = statusRepository.pushPeopleState(state);
        this.lastUserStateCache.set(state.user_id, { ...state, ...newState });
    }
}

export const userService = new UserService();
