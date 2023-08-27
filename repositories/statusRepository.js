// eslint-disable-next-line @typescript-eslint/no-unused-vars
const State = require("../models/State");
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const UserState = require("../models/UserState");

const BaseRepository = require("./baseRepository");

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
    getAllUserStates() {
        return /** @type {UserState[]} */ (this.db.prepare("SELECT * FROM userstates ORDER BY date DESC").all());
    }

    /**
     * @param {string} username
     * @param {number} fromDate
     * @param {number} toDate
     * @returns {UserState[]}
     */
    getUserStates(username, fromDate = 0, toDate = Date.now()) {
        return /** @type {UserState[]} */ (
            this.db
                .prepare("SELECT * FROM userstates WHERE username = ? AND date BETWEEN ? AND ? ORDER BY date")
                .all(username, fromDate, toDate)
        );
    }

    /**
     * @param {UserState} userState
     * @returns {boolean}
     */
    updateUserState(userState) {
        return (
            this.db
                .prepare("UPDATE userstates SET username = ?, status = ?, date = ?, type = ?, note = ? WHERE id = ?")
                .run(userState.username, userState.status, userState.date, userState.type, userState.note, userState.id).changes >
            0
        );
    }

    /**
     * @param {number} stateId
     * @returns {boolean}
     */
    removeUserState(stateId) {
        return this.db.prepare("DELETE FROM userstates WHERE id = ?").run(stateId).changes > 0;
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
            .prepare("INSERT INTO userstates (status, username, date, type, note) VALUES (?, ?, ?, ?, ?)")
            .run(
                state.status ? state.status : this.UserStatusType.Outside,
                state.username,
                state.date.valueOf(),
                state.type ?? 0,
                state.note
            );
    }
}

module.exports = new StatusRepository();
