import { User, UserState, UserStateEx } from "@data/models";
import { UserStateChangeType, UserStateType } from "@data/types";

import statusRepository from "@repositories/status";
import { convertToElapsedObject, ElapsedTimeObject, isToday, MONTH } from "@utils/date";
import { anyItemIsInList } from "@utils/filters";

import broadcast, { BroadcastEvents } from "./broadcast";
import { fetchDevicesInside } from "./embassy";

export type UserVisit = { user: User; usertime: ElapsedTimeObject };

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
    return userState.status === (UserStateType.Inside as number);
}

export function filterAllPeopleInside(userState: UserState): boolean {
    return userState.status === (UserStateType.Inside as number) || userState.status === (UserStateType.InsideSecret as number);
}

export function filterPeopleGoing(userState: UserState): boolean {
    return userState.status === (UserStateType.Going as number) && isToday(new Date(userState.date));
}

// Classes

export class SpaceStateService {
    static openSpace(opener: User, options: { checkOpener: boolean } = { checkOpener: false }): void {
        const opendate = new Date();
        const state = {
            open: 1,
            date: opendate.getTime(),
            changer_id: opener.userid,
            changer: opener,
        };

        statusRepository.pushSpaceState(state);

        broadcast.emit(BroadcastEvents.SpaceOpened, state);

        if (!options.checkOpener) return;

        const userstate = {
            status: UserStateType.Inside,
            date: opendate.getTime(),
            until: null,
            user_id: opener.userid,
            type: UserStateChangeType.Opened,
            note: null,
            user: opener,
        };

        UserStateService.pushPeopleState(userstate);
    }

    static closeSpace(closer: User): void {
        const state = {
            open: 0,
            date: Date.now(),
            changer_id: closer.userid,
            changer: closer,
        };

        statusRepository.pushSpaceState(state);

        broadcast.emit(BroadcastEvents.SpaceClosed, state);
    }
}

export class UserStateService {
    private static lastUserStateCache: Map<number, UserStateEx> = new Map();

    static getRecentUserStates() {
        if (this.lastUserStateCache.size === 0) {
            const allUserStates = statusRepository.getAllUserStates(new Date().getTime() - MONTH);

            for (const userstate of allUserStates) {
                if (this.lastUserStateCache.has(userstate.user_id)) continue;

                this.lastUserStateCache.set(userstate.user_id, userstate);
            }
        }

        return Array.from(this.lastUserStateCache.values());
    }

    static refreshCachedUser(user: User): void {
        const userState = this.lastUserStateCache.get(user.userid);

        if (!userState) return;

        this.lastUserStateCache.set(user.userid, { ...userState, user });
    }

    static pushPeopleState(state: Omit<UserStateEx, "id">): void {
        const newState = statusRepository.pushPeopleState(state);
        this.lastUserStateCache.set(state.user_id, { ...state, ...newState });
    }

    static evictPeople(): void {
        const date = Date.now();
        const peopleInside = UserStateService.getRecentUserStates().filter(filterPeopleInside);

        for (const userstate of peopleInside) {
            UserStateService.pushPeopleState({
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

    static getAllVisits(fromDate: Date, toDate: Date): UserVisit[] {
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
                usertime: UserStateService.getUserTotalTime(userStates),
            });
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
}
