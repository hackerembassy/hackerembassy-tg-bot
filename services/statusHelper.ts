import UserState, { UserStateChangeType, UserStateType } from "@models/UserState";
import statusRepository from "@repositories/status";
import { convertToElapsedObject, ElapsedTimeObject, isToday } from "@utils/date";
import { anyItemIsInList, onlyUniqueInsFilter } from "@utils/filters";
import { equalsIns } from "@utils/text";
import User from "@models/User";

import broadcast, { BroadcastEvents } from "./broadcast";
import { fetchDevicesInside } from "./embassy";

export type UserVisit = { username: string; usertime: ElapsedTimeObject };

const ANON_USERNAME = "anon";

export async function hasDeviceInside(user: User): Promise<boolean> {
    try {
        const devices = await fetchDevicesInside();

        return user.mac ? isMacInside(user.mac, devices) : false;
    } catch {
        return false;
    }
}

export function isMacInside(mac: string, devices: string[]): boolean {
    return anyItemIsInList(mac.split(","), devices);
}

// Filters

export function filterPeopleInside(userState: UserState): boolean {
    return userState.status === UserStateType.Inside;
}

export function filterAllPeopleInside(userState: UserState): boolean {
    return userState.status === UserStateType.Inside || userState.status === UserStateType.InsideSecret;
}

export function filterPeopleGoing(userState: UserState): boolean {
    return userState.status === UserStateType.Going && isToday(new Date(userState.date));
}

// Classes

export class SpaceStateService {
    static openSpace(opener: Optional<string>, options: { checkOpener: boolean } = { checkOpener: false }): void {
        const opendate = new Date();
        const state = {
            id: 0,
            open: true,
            date: opendate,
            changedby: opener ?? ANON_USERNAME,
        };

        statusRepository.pushSpaceState(state);

        broadcast.emit(BroadcastEvents.SpaceOpened, state);

        if (!options.checkOpener) return;

        const userstate = {
            id: 0,
            status: UserStateType.Inside,
            date: opendate,
            until: null,
            username: opener ?? ANON_USERNAME,
            type: UserStateChangeType.Opened,
            note: null,
        };

        UserStateService.pushPeopleState(userstate);
    }

    static closeSpace(closer?: string): void {
        const state = {
            id: 0,
            open: false,
            date: new Date(),
            changedby: closer ?? ANON_USERNAME,
        };

        statusRepository.pushSpaceState(state);

        broadcast.emit(BroadcastEvents.SpaceClosed, state);
    }
}

export class UserStateService {
    private static lastUserStateCache: Map<string, UserState> = new Map();

    private static findRecentStates(allUserStates: UserState[]) {
        const usersLastStates: UserState[] = [];

        for (const userstate of allUserStates) {
            if (!usersLastStates.find(us => equalsIns(us.username, userstate.username))) {
                usersLastStates.push({ ...userstate, date: new Date(userstate.date) });
            }
        }

        return usersLastStates;
    }

    static getRecentUserStates(): UserState[] {
        if (this.lastUserStateCache.size === 0) {
            const recentStates = UserStateService.findRecentStates(statusRepository.getAllUserStates());
            this.lastUserStateCache = new Map(recentStates.map(us => [us.username.toLowerCase(), us]));
        }

        return Array.from(this.lastUserStateCache.values());
    }

    static pushPeopleState(state: UserState): void {
        statusRepository.pushPeopleState(state);
        this.lastUserStateCache.set(state.username.toLowerCase(), state);
    }

    static evictPeople(): void {
        const date = Date.now();
        const peopleInside = UserStateService.getRecentUserStates().filter(filterPeopleInside);

        for (const userstate of peopleInside) {
            UserStateService.pushPeopleState({
                id: 0,
                status: UserStateType.Outside,
                date: date,
                until: null,
                username: userstate.username,
                type: UserStateChangeType.Evicted,
                note: null,
            });
        }
    }

    static getAllVisits(fromDate: Date, toDate: Date): UserVisit[] {
        // TODO query only required dates
        const allUserStates = statusRepository.getAllUserStates();
        const userNames = UserStateService.getRecentUserStates()
            .map(us => us.username)
            .filter(onlyUniqueInsFilter);
        const usersVisits: UserVisit[] = [];

        for (const username of userNames) {
            const userStates = allUserStates.filter(
                us =>
                    equalsIns(us.username, username) &&
                    Number(us.date) >= fromDate.getTime() &&
                    Number(us.date) <= toDate.getTime()
            );
            usersVisits.push({ username: username, usertime: UserStateService.getUserTotalTime(userStates) });
        }

        return usersVisits
            .filter(ut => ut.usertime.totalSeconds > 59)
            .sort((a, b) => (a.usertime.totalSeconds > b.usertime.totalSeconds ? -1 : 1));
    }

    static getUserTotalTime(userStates: UserState[]): ElapsedTimeObject {
        // TODO Memoize and persist results of this export function for each user
        // to not compute all time from the start every time
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
}
