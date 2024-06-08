import UserState, { UserStateChangeType, UserStateType } from "../models/UserState";
import statusRepository from "../repositories/statusRepository";
import usersRepository from "../repositories/usersRepository";
import broadcast, { BroadcastEvents } from "../utils/broadcast";
import { anyItemIsInList, onlyUniqueInsFilter } from "../utils/common";
import { convertToElapsedObject, ElapsedTimeObject, isToday } from "../utils/date";
import { equalsIns } from "../utils/text";
import { fetchDevicesInside } from "./embassy";

export type UserStatsTime = { username: string; usertime: ElapsedTimeObject };

const ANON_USERNAME = "anon";

export function openSpace(opener: Optional<string>, options: { checkOpener: boolean } = { checkOpener: false }): void {
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

export function closeSpace(closer: Nullable<string> | undefined, options: { evict: boolean } = { evict: false }): void {
    const state = {
        id: 0,
        open: false,
        date: new Date(),
        changedby: closer ?? ANON_USERNAME,
    };

    statusRepository.pushSpaceState(state);

    broadcast.emit(BroadcastEvents.SpaceClosed, state);

    const allUserStates = statusRepository.getAllUserStates();

    if (options.evict) evictPeople(findRecentStates(allUserStates).filter(filterPeopleInside));
}

export async function hasDeviceInside(username: Optional<string>): Promise<boolean> {
    if (!username) return false;

    try {
        const devices = await fetchDevicesInside();
        const mac = usersRepository.getUserByName(username)?.mac;

        return mac ? isMacInside(mac, devices) : false;
    } catch {
        return false;
    }
}

export function isMacInside(mac: string, devices: string[]): boolean {
    return anyItemIsInList(mac.split(","), devices);
}

export function getUserTimeDescriptor(userStates: UserState[]): ElapsedTimeObject {
    // TODO Memoize and persist results of this export function for each user
    // to not compute all time from the start every time
    let totalTime = 0;
    let startTime = -1;

    userStates.sort((a, b) => (a.date > b.date ? 1 : -1));

    for (const userState of userStates) {
        if (startTime === -1 && userState.status === UserStateType.Inside) {
            startTime = Number(userState.date);
        } else if (startTime !== -1 && (userState.status === UserStateType.Outside || userState.status === UserStateType.Going)) {
            totalTime += Number(userState.date) - startTime;
            startTime = -1;
        }
    }

    return convertToElapsedObject(totalTime / 1000);
}

export function findRecentStates(allUserStates: UserState[]) {
    const usersLastStates: UserState[] = [];

    for (const userstate of allUserStates) {
        if (!usersLastStates.find(us => equalsIns(us.username, userstate.username))) {
            usersLastStates.push({ ...userstate, date: new Date(userstate.date) });
        }
    }

    return usersLastStates;
}

export function getAllUsersTimes(allUserStates: UserState[], fromDate: Date, toDate: Date): UserStatsTime[] {
    const userNames = findRecentStates(allUserStates)
        .map(us => us.username)
        .filter(onlyUniqueInsFilter);
    const usersTimes: UserStatsTime[] = [];

    for (const username of userNames) {
        const userStates = allUserStates.filter(
            us => equalsIns(us.username, username) && Number(us.date) >= fromDate.getTime() && Number(us.date) <= toDate.getTime()
        );
        usersTimes.push({ username: username, usertime: getUserTimeDescriptor(userStates) });
    }

    return usersTimes
        .filter(ut => ut.usertime.totalSeconds > 59)
        .sort((a, b) => (a.usertime.totalSeconds > b.usertime.totalSeconds ? -1 : 1));
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

export function evictPeople(insideStates: UserState[]): void {
    const date = Date.now();

    for (const userstate of insideStates) {
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

export class UserStateService {
    private static lastUserStateCache: Map<string, UserState> = new Map();

    static getRecentUserStates(): UserState[] {
        if (this.lastUserStateCache.size === 0) {
            const recentStates = findRecentStates(statusRepository.getAllUserStates());
            this.lastUserStateCache = new Map(recentStates.map(us => [us.username.toLowerCase(), us]));
        }

        return Array.from(this.lastUserStateCache.values());
    }

    static pushPeopleState(state: UserState): void {
        statusRepository.pushPeopleState(state);
        this.lastUserStateCache.set(state.username.toLowerCase(), state);
    }
}
