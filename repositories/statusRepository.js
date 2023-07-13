// eslint-disable-next-line no-unused-vars
const State = require("../models/State");
// eslint-disable-next-line no-unused-vars
const UserState = require("../models/UserState");
const BaseRepository = require("./baseRepository");

/**
 * @param {Date} someDate
 * @returns {boolean}
 */
const isToday = someDate => {
    const today = new Date();
    return (
        someDate.getDate() == today.getDate() &&
        someDate.getMonth() == today.getMonth() &&
        someDate.getFullYear() == today.getFullYear()
    );
};

class StatusRepository extends BaseRepository {
    ChangeType = {
        Manual: 0,
        Auto: 1,
        Force: 2,
        Opened: 3,
        Evicted: 4,
    };

    UserStatusType = {
        Outside: 0,
        Inside: 1,
        Going: 2,
    };

    /**
     *  @returns {State}
     */
    getSpaceLastState() {
        let lastState = /** @type {State} */ (this.db.prepare("SELECT * FROM states ORDER BY date DESC").get());

        if (!lastState) return null;

        lastState.date = new Date(lastState.date);

        return lastState;
    }

    /**
     *  @returns {UserState[]}
     */
    getLastStatuses() {
        let userstates = /** @type {UserState[]} */ (this.db.prepare("SELECT * FROM userstates ORDER BY date DESC").all());
        let usersLastStatuses = [];

        for (const userstate of userstates) {
            if (!usersLastStatuses.find(us => us.username === userstate.username)) {
                userstate.date = new Date(userstate.date);
                usersLastStatuses.push(userstate);
            }
        }

        return usersLastStatuses;
    }

    /**
     *  @returns {UserState[]}
     */
    getUserStatuses(username) {
        return /** @type {UserState[]} */ (
            this.db.prepare("SELECT * FROM userstates WHERE username = ? ORDER BY date").all(username)
        );
    }

    /**
     *  @returns {UserState[]}
     */
    getPeopleInside() {
        let usersLastStatuses = this.getLastStatuses();
        let usersInside = usersLastStatuses.filter(us => us.status === this.UserStatusType.Inside);

        return usersInside;
    }

    /**
     *  @returns {Object[]}
     */
    getPeopleGoing() {
        let usersLastStatuses = this.getLastStatuses();
        let usersGoing = usersLastStatuses.filter(us => us.status === this.UserStatusType.Going && isToday(new Date(us.date)));

        return usersGoing;
    }

    /**
     *  @returns {void}
     */
    evictPeople() {
        let inside = this.getPeopleInside();
        let date = Date.now();

        for (const userstate of inside) {
            this.pushPeopleState({
                id: 0,
                status: this.UserStatusType.Outside,
                date: date,
                username: userstate.username,
                type: this.ChangeType.Evicted,
            });
        }
    }

    /**
     * @param {State} state
     * @returns {void}
     */
    pushSpaceState(state) {
        this.db
            .prepare("INSERT INTO states (open, changedby, date) VALUES (?, ?, ?)")
            .run(state.open ? 1 : 0, state.changedby, state.date.valueOf());
    }

    /**
     * @param {UserState} state
     * @returns {void}
     */
    pushPeopleState(state) {
        this.db
            .prepare("INSERT INTO userstates (status, username, date, type) VALUES (?, ?, ?, ?)")
            .run(
                state.status ? state.status : this.UserStatusType.Outside,
                state.username,
                state.date.valueOf(),
                state.type ?? 0
            );
    }
}

module.exports = new StatusRepository();
