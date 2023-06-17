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

module.exports = { openSpace, closeSpace, isMacInside, hasDeviceInside };
