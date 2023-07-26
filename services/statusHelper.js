// eslint-disable-next-line no-unused-vars
const UserState = require("../models/UserState");

/**
 * @typedef {import("../utils/date").ElapsedTimeObject} ElapsedTimeObject
 */

const statusRepository = require("../repositories/statusRepository");
const usersRepository = require("../repositories/usersRepository");
const { anyItemIsInList } = require("../utils/common");
const { fetchWithTimeout } = require("../utils/network");
const { onlyUniqueFilter } = require("../utils/common");
const { isToday } = require("../utils/date");
const { UserStatusType, ChangeType } = require("../repositories/statusRepository");

const embassyApiConfig = require("config").get("embassy-api");

/**
 * @param {string} opener
 * @param {{checkOpener: boolean}} options
 * @returns {void}
 */
function openSpace(opener, options = { checkOpener: false }) {
    let opendate = new Date();
    let state = {
        id: 0,
        open: true,
        date: opendate,
        changedby: opener,
    };

    statusRepository.pushSpaceState(state);

    if (!options.checkOpener) return;

    let userstate = {
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
function closeSpace(closer, options = { evict: false }) {
    let state = {
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
async function hasDeviceInside(username) {
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
function isMacInside(mac, devices) {
    return mac ? anyItemIsInList(mac.split(","), devices) : false;
}

/**
 * @param {UserState[]} userStates
 * @returns {ElapsedTimeObject}
 */
function getUserTimeDescriptor(userStates) {
    // TODO Memoize and persist results of this function for each user
    // to not compute all time from the start every time
    let totalTime = 0;
    let startTime = -1;

    for (const userState of userStates.sort((a, b) => (a.date > b.date ? 1 : -1))) {
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
function convertToElapsedObject(seconds) {
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
function findRecentStates(allUserStates) {
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
function getAllUsersTimes(allUserStates, fromDate, toDate) {
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
function filterPeopleInside(userState) {
    return userState.status === UserStatusType.Inside;
}

/**
 * @param {UserState} userState
 * @returns {boolean}
 */
function filterPeopleGoing(userState) {
    return userState.status === UserStatusType.Going && isToday(new Date(userState.date));
}

/**
 * @param {UserState[]} insideStates
 * @returns {void}
 */
function evictPeople(insideStates) {
    let date = Date.now();

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

module.exports = {
    openSpace,
    closeSpace,
    isMacInside,
    hasDeviceInside,
    getUserTimeDescriptor,
    findRecentStates,
    getAllUsersTimes,
    evictPeople,
    filterPeopleInside,
    filterPeopleGoing,
};
