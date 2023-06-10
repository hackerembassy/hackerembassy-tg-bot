const StatusRepository = require("../repositories/statusRepository");
const { anyItemIsInList } = require("../utils/common");

function openSpace(opener, options = { checkOpener: false }) {
    let opendate = new Date();
    let state = {
        open: true,
        date: opendate,
        changedby: opener,
    };

    StatusRepository.pushSpaceState(state);

    if (!options.checkOpener) return;

    let userstate = {
        status: StatusRepository.UserStatusType.Inside,
        date: opendate,
        username: opener,
        type: StatusRepository.ChangeType.Opened,
    };

    StatusRepository.pushPeopleState(userstate);
}

function closeSpace(closer, options = { evict: false }) {
    let state = {
        open: false,
        date: new Date(),
        changedby: closer,
    };

    StatusRepository.pushSpaceState(state);

    if (options.evict) StatusRepository.evictPeople();
}

function isMacInside(mac, devices) {
    return mac ? anyItemIsInList(mac.split(","), devices) : false;
}

module.exports = { openSpace, closeSpace, isMacInside };
