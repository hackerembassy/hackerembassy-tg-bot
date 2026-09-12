import { AutoInsideMode, UserRole, UserStateChangeType, UserStateType } from "@data/types";
import { User, UserState, UserStateEx } from "@data/models";
import { DefaultUser } from "@data/seed";

import statusRepository from "@data/repositories/status";
import usersRepository from "@data/repositories/users";
import devicesRepository from "@data/repositories/devices";
import apiKeysRepository from "@data/repositories/apikeys";

import logger from "@services/common/logger";
import { convertToElapsedObject, ElapsedTimeObject, isToday, MONTH } from "@utils/date";
import { generateRandomKey, sha256 } from "@utils/common";
import { isValidMAC } from "@utils/network";

import { spaceService } from "./space";

// Types
export type UserVisit = { user: User; usertime: ElapsedTimeObject };

// Filters
function filterPeopleInside(userState: UserState): boolean {
    return userState.status === UserStateType.Inside;
}

function filterAllPeopleInside(userState: UserState): boolean {
    return userState.status === UserStateType.Inside || userState.status === UserStateType.InsideSecret;
}

function filterPeopleGoing(userState: UserState): boolean {
    return userState.status === UserStateType.Going && isToday(new Date(userState.date));
}

function filterAutoState(userState: UserState): boolean {
    return userState.type === UserStateChangeType.Auto;
}

// helper functions
export function splitRoles(user: User) {
    return user.roles?.split("|") as UserRole[];
}

export function hasRole(user: User, ...roles: UserRole[]) {
    return user.roles?.length === 0 ? false : splitRoles(user).some(r => roles.includes(r));
}

export function isBanned(user: User) {
    return user.roles?.includes("banned");
}

export function sanitizeUsername(username: string): string {
    return username.replace("@", "");
}

// Classes
class UserService {
    private readonly lastUserStateCache: Map<number, UserStateEx> = new Map();

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

    public prepareUser(tgUser: { id: number; username?: string; first_name?: string }): User {
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
            ? usersRepository.getUserByName(sanitizeUsername(identifier))
            : usersRepository.getUserByUserId(identifier);
    }

    // For an identifier of uncertain shape (e.g. free-text admin input) - tries it as a user id
    // first, then falls back to a username lookup. Telegram usernames can never be purely
    // numeric, so a numeric-looking string only ever matches the id branch anyway; the order
    // just avoids a wasted query rather than changing which user (if any) is found.
    public resolveUser(identifier: number | string) {
        return this.getUser(Number(identifier)) ?? this.getUser(identifier);
    }

    public getUsers() {
        return usersRepository.getUsers();
    }

    public getUsersByRole(role: string) {
        return usersRepository.getUsersByRole(role);
    }

    public getUsersWithBirthdays() {
        return usersRepository.getUsersWithBirthdays();
    }

    public getSponsors() {
        return usersRepository.getSponsors();
    }

    public addUser(userid: number, username: Optional<string>, roles?: string[]) {
        return usersRepository.addUser(userid, username, roles);
    }

    public setRoles(userid: number, roles: string[]) {
        const success = usersRepository.updateRoles(userid, roles);

        if (success) this.refreshCachedUserFields(userid, { roles: roles.join("|") });

        return success;
    }

    public setLanguage(user: User, language: string) {
        const success = usersRepository.updateUser(user.userid, { language });

        if (success) this.refreshCachedUserFields(user.userid, { language });

        return success;
    }

    // Removing a user leaves their last known presence state (if any) behind in the cache -
    // without this it would keep surfacing as a phantom entry in getPeopleInside/getUserState
    // until the cache naturally rebuilds (see getRecentUserStates).
    public removeUser(identifier: number | string) {
        const userid = typeof identifier === "number" ? identifier : this.getUser(identifier)?.userid;
        const success =
            typeof identifier === "string"
                ? usersRepository.removeUserByUsername(sanitizeUsername(identifier))
                : usersRepository.removeUserById(identifier);

        if (success && userid !== undefined) this.lastUserStateCache.delete(userid);

        return success;
    }

    public setBithday(user: User, date: string | null) {
        const fulldate = date?.length === 5 ? "0000-" + date : date;
        const success = usersRepository.updateUser(user.userid, { birthday: fulldate });

        if (success) this.refreshCachedUserFields(user.userid, { birthday: fulldate });

        return success;
    }

    public setAutoinside(user: User, mode: AutoInsideMode) {
        const success = usersRepository.updateUser(user.userid, { autoinside: mode });

        if (success) this.refreshCachedUserFields(user.userid, { autoinside: mode });

        return success;
    }

    public setEmoji(user: User, emoji: string | null) {
        const success = usersRepository.updateUser(user.userid, { emoji });

        if (success) this.refreshCachedUserFields(user.userid, { emoji });

        return success;
    }

    public saveUser(user: User) {
        this.refreshCachedUserFields(user.userid, user);
        return usersRepository.updateUser(user.userid, user);
    }

    public getApiKey(user: User) {
        return apiKeysRepository.getKeyByUser(user.userid);
    }

    // Refuses to overwrite an existing key - the caller must revoke it first
    public issueApiKey(user: User): string | undefined {
        if (this.getApiKey(user)) return undefined;

        const newKey = generateRandomKey();
        apiKeysRepository.addKey(user.userid, sha256(newKey));

        return newKey;
    }

    public revokeApiKey(user: User): boolean {
        const key = this.getApiKey(user);

        if (!key) return false;

        return apiKeysRepository.removeKey(key.id);
    }

    public getUserState(user: User): UserStateEx | undefined {
        this.getRecentUserStates(); // ensure lastUserStateCache is hydrated

        return this.lastUserStateCache.get(user.userid);
    }

    public getPeopleInside(includeSecret = false): UserStateEx[] {
        return this.getRecentUserStates().filter(includeSecret ? filterAllPeopleInside : filterPeopleInside);
    }

    public getPeopleAutoInside(): UserStateEx[] {
        return this.getRecentUserStates().filter(state => filterAllPeopleInside(state) && filterAutoState(state));
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
            date: Date.now(),
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

    public addUserMac(user: User, mac: string) {
        try {
            if (!isValidMAC(mac)) throw new Error("Provided MAC is not valid");

            return devicesRepository.addDevice(user.userid, mac.toLowerCase());
        } catch (error) {
            logger.error(error);
            return false;
        }
    }

    public removeUserMacs(user: User) {
        return devicesRepository.removeUserDevices(user.userid).changes > 0;
    }

    public removeUserMac(user: User, mac: string) {
        const existingDevice = devicesRepository.getDeviceByMac(mac);

        if (!existingDevice || existingDevice.user_id !== user.userid) return false;

        return devicesRepository.removeDeviceByMac(mac).changes > 0;
    }

    public getUserMacs(user: User) {
        return devicesRepository.getDevicesByUserId(user.userid);
    }

    public getDevicesWithAutousers() {
        return devicesRepository.getDevices(true).filter(ud => ud.user.autoinside && ud.user.autoinside > 0);
    }

    public getDevicesWithUsers() {
        return devicesRepository.getDevices(true);
    }

    private getUserTotalTimeInternal(userStates: UserState[]): ElapsedTimeObject {
        let totalTime = 0;
        let startTime = -1;

        userStates.sort((a, b) => (a.date > b.date ? 1 : -1));

        for (const userState of userStates) {
            if (startTime === -1 && userState.status === UserStateType.Inside) {
                startTime = Number(userState.date);
            } else if (
                startTime !== -1 &&
                (userState.status === UserStateType.Outside || userState.status === UserStateType.Going)
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
            const allUserStates = statusRepository.getAllUserStates(Date.now() - MONTH);

            for (const userstate of allUserStates) {
                if (this.lastUserStateCache.has(userstate.user_id)) continue;

                this.lastUserStateCache.set(userstate.user_id, userstate);
            }
        }

        return [...this.lastUserStateCache.values()];
    }

    private refreshCachedUserFields(userid: number, fields: Partial<User>): void {
        const userState = this.lastUserStateCache.get(userid);

        if (!userState) return;

        this.lastUserStateCache.set(userid, { ...userState, user: { ...userState.user, ...fields } });
    }

    private pushPeopleState(state: Omit<UserStateEx, "id">): void {
        const newState = statusRepository.pushPeopleState(state);
        this.lastUserStateCache.set(state.user_id, { ...state, ...newState });
    }
}

export const userService = new UserService();
