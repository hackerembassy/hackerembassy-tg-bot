const statusRepository = require("../repositories/statusRepository");
const usersRepository = require("../repositories/usersRepository");
const { anyItemIsInList } = require("../utils/common");
const { fetchWithTimeout } = require("../utils/network");

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

    if (options.evict) statusRepository.evictPeople();
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
 * @param {string} username
 * @param {number} fromDate
 * @param {number} toDate
 */
function getUserTime(username, fromDate = 0, toDate = Date.now()) {
    // TODO Memoize and persist results of this function for each user
    // to not compute all time from the start every time
    const userStatuses = statusRepository.getUserStatuses(username, fromDate, toDate);

    let time = 0;
    let startTime = -1;

    for (const userStatus of userStatuses) {
        if (startTime === -1 && userStatus.status === statusRepository.UserStatusType.Inside) {
            startTime = new Date(userStatus.date).getTime();
        } else if (
            startTime !== -1 &&
            (userStatus.status === statusRepository.UserStatusType.Outside ||
                userStatus.status === statusRepository.UserStatusType.Going)
        ) {
            time += new Date(userStatus.date).getTime() - startTime;
            startTime = -1;
        }
    }

    return convertToElapsedObject(time / 1000);
}

/**
 * @param {number} seconds
 */
function convertToElapsedObject(seconds) {
    return {
        days: Math.floor(seconds / (3600 * 24)),
        hours: Math.floor((seconds % (3600 * 24)) / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
        totalSeconds: seconds,
    };
}

module.exports = { openSpace, closeSpace, isMacInside, hasDeviceInside, getUserTime };
