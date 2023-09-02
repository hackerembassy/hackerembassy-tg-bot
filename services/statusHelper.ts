import config from "config";

import { EmbassyApiConfig } from "../config/schema";
import UserState, { UserStateChangeType, UserStateType } from "../models/UserState";
import statusRepository from "../repositories/statusRepository";
import usersRepository from "../repositories/usersRepository";
import { anyItemIsInList } from "../utils/common";
import { onlyUniqueFilter } from "../utils/common";
import { ElapsedTimeObject, isToday } from "../utils/date";
import { fetchWithTimeout } from "../utils/network";

const embassyApiConfig = config.get("embassy-api") as EmbassyApiConfig;

export function openSpace(opener: string, options: { checkOpener: boolean } = { checkOpener: false }): void {
    const opendate = new Date();
    const state = {
        id: 0,
        open: true,
        date: opendate,
        changedby: opener,
    };

    statusRepository.pushSpaceState(state);

    if (!options.checkOpener) return;

    const userstate = {
        id: 0,
        status: UserStateType.Inside,
        date: opendate,
        username: opener,
        type: UserStateChangeType.Opened,
        note: null,
    };

    statusRepository.pushPeopleState(userstate);
}

export function closeSpace(closer: string, options: { evict: boolean } = { evict: false }): void {
    const state = {
        id: 0,
        open: false,
        date: new Date(),
        changedby: closer,
    };

    statusRepository.pushSpaceState(state);

    if (options.evict) evictPeople(findRecentStates(statusRepository.getAllUserStates()).filter(filterPeopleInside));
}

export async function hasDeviceInside(username: string): Promise<boolean> {
    try {
        const response = await fetchWithTimeout(
            `${embassyApiConfig.host}:${embassyApiConfig.port}/${embassyApiConfig.devicesCheckingPath}`
        );
        const devices = await response?.json();

        return isMacInside(usersRepository.getUserByName(username).mac, devices);
    } catch {
        return false;
    }
}

export function isMacInside(mac: string, devices: string[]): boolean {
    return mac ? anyItemIsInList(mac.split(","), devices) : false;
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

export function convertToElapsedObject(seconds: number): ElapsedTimeObject {
    return {
        days: Math.floor(seconds / (3600 * 24)),
        hours: Math.floor((seconds % (3600 * 24)) / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
        totalSeconds: seconds,
    };
}

export function findRecentStates(allUserStates: UserState[]) {
    const usersLastStates = [];

    for (const userstate of allUserStates) {
        if (!usersLastStates.find(us => us.username === userstate.username)) {
            userstate.date = new Date(userstate.date);
            usersLastStates.push(userstate);
        }
    }

    return usersLastStates;
}

export function getAllUsersTimes(allUserStates: UserState[], fromDate: Date, toDate: Date) {
    const userNames = findRecentStates(allUserStates)
        .map(us => us.username)
        .filter(onlyUniqueFilter);
    let usersTimes = [];

    for (const username of userNames) {
        const userStates = allUserStates.filter(us => us.username === username && us.date >= fromDate && us.date <= toDate);
        usersTimes.push({ username: username, usertime: getUserTimeDescriptor(userStates) });
    }

    usersTimes = usersTimes.filter(ut => ut.usertime.totalSeconds > 59);
    usersTimes.sort((a, b) => (a.usertime.totalSeconds > b.usertime.totalSeconds ? -1 : 1));

    return usersTimes;
}

export function filterPeopleInside(userState: UserState): boolean {
    return userState.status === UserStateType.Inside;
}

export function filterPeopleGoing(userState: UserState): boolean {
    return userState.status === UserStateType.Going && isToday(new Date(userState.date));
}

export function evictPeople(insideStates: UserState[]): void {
    const date = Date.now();

    for (const userstate of insideStates) {
        statusRepository.pushPeopleState({
            id: 0,
            status: UserStateType.Outside,
            date: date,
            username: userstate.username,
            type: UserStateChangeType.Evicted,
            note: null,
        });
    }
}
