import statusRepository from "../repositories/statusRepository";
import usersRepository from "../repositories/usersRepository";
import { anyItemIsInList } from "../utils/common";
import { fetchWithTimeout } from "../utils/network";
import { onlyUniqueFilter } from "../utils/common";
import { ElapsedTimeObject, isToday } from "../utils/date";
import UserState from "../models/UserState";
const { UserStatusType, ChangeType } = statusRepository;

const embassyApiConfig = require("config").get("embassy-api");

/**
 * @param {string} opener
 * @param {{checkOpener: boolean}} options
 * @returns {void}
 */
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
        status: statusRepository.UserStatusType.Inside,
        date: opendate,
        username: opener,
        type: statusRepository.ChangeType.Opened,
        note: null,
    };

    statusRepository.pushPeopleState(userstate);
}

/**
 * @param {string} closer
 * @param {{evict: boolean}} options
 * @returns {void}
 */
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

/**
 * @param {string} username
 * @returns {Promise<boolean>}
 */
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

/**
 * @param {string} mac
 * @param {string[]} devices
 * @returns {boolean}
 */
export function isMacInside(mac: string, devices: string[]): boolean {
    return mac ? anyItemIsInList(mac.split(","), devices) : false;
}

/**
 * @param {UserState[]} userStates
 * @returns {ElapsedTimeObject}
 */
export function getUserTimeDescriptor(userStates: UserState[]): ElapsedTimeObject {
    // TODO Memoize and persist results of this export function for each user
    // to not compute all time from the start every time
    let totalTime = 0;
    let startTime = -1;

    userStates.sort((a, b) => (a.date > b.date ? 1 : -1));

    for (const userState of userStates) {
        if (startTime === -1 && userState.status === statusRepository.UserStatusType.Inside) {
            startTime = Number(userState.date);
        } else if (
            startTime !== -1 &&
            (userState.status === statusRepository.UserStatusType.Outside ||
                userState.status === statusRepository.UserStatusType.Going)
        ) {
            totalTime += Number(userState.date) - startTime;
            startTime = -1;
        }
    }

    return convertToElapsedObject(totalTime / 1000);
}

/**
 * @param {number} seconds
 * @returns {ElapsedTimeObject}
 */
export function convertToElapsedObject(seconds: number): ElapsedTimeObject {
    return {
        days: Math.floor(seconds / (3600 * 24)),
        hours: Math.floor((seconds % (3600 * 24)) / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
        totalSeconds: seconds,
    };
}

/**
 * @param {UserState[]} allUserStates
 */
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

/**
 * @param {UserState[]} allUserStates
 * @param {Date} fromDate
 * @param {Date} toDate
 */
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

/**
 * @param {UserState} userState
 * @returns {boolean}
 */
export function filterPeopleInside(userState: UserState): boolean {
    return userState.status === UserStatusType.Inside;
}

/**
 * @param {UserState} userState
 * @returns {boolean}
 */
export function filterPeopleGoing(userState: UserState): boolean {
    return userState.status === UserStatusType.Going && isToday(new Date(userState.date));
}

/**
 * @param {UserState[]} insideStates
 * @returns {void}
 */
export function evictPeople(insideStates: UserState[]): void {
    const date = Date.now();

    for (const userstate of insideStates) {
        statusRepository.pushPeopleState({
            id: 0,
            status: UserStatusType.Outside,
            date: date,
            username: userstate.username,
            type: ChangeType.Evicted,
            note: null,
        });
    }
}
