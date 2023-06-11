const StatusRepository = require("../repositories/statusRepository");
const { anyItemIsInList } = require("../utils/common");

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

    StatusRepository.pushSpaceState(state);

    if (!options.checkOpener) return;

    let userstate = {
        id: 0,
        status: StatusRepository.UserStatusType.Inside,
        date: opendate,
        username: opener,
        type: StatusRepository.ChangeType.Opened,
    };

    StatusRepository.pushPeopleState(userstate);
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

    StatusRepository.pushSpaceState(state);

    if (options.evict) StatusRepository.evictPeople();
}

/**
 * @param {string} mac
 * @param {string[]} devices
 * @returns {boolean}
 */
function isMacInside(mac, devices) {
    return mac ? anyItemIsInList(mac.split(","), devices) : false;
}

module.exports = { openSpace, closeSpace, isMacInside };
