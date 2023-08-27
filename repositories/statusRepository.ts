import State from "../models/State";
import UserState from "../models/UserState";

import BaseRepository from "./baseRepository";

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
    getSpaceLastState(): State {
        const lastState = /** @type {State} */ this.db.prepare("SELECT * FROM states ORDER BY date DESC").get() as State;

        if (!lastState) return null;

        lastState.date = new Date(lastState.date);

        return lastState;
    }

    /**
     *  @returns {UserState[]}
     */
    getAllUserStates(): UserState[] {
        return this.db.prepare("SELECT * FROM userstates ORDER BY date DESC").all() as UserState[];
    }

    /**
     * @param {string} username
     * @param {number} fromDate
     * @param {number} toDate
     * @returns {UserState[]}
     */
    getUserStates(username: string, fromDate: number = 0, toDate: number = Date.now()): UserState[] {
        return /** @type {UserState[]} */ this.db
            .prepare("SELECT * FROM userstates WHERE username = ? AND date BETWEEN ? AND ? ORDER BY date")
            .all(username, fromDate, toDate) as UserState[];
    }

    /**
     * @param {UserState} userState
     * @returns {boolean}
     */
    updateUserState(userState: UserState): boolean {
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
    removeUserState(stateId: number): boolean {
        return this.db.prepare("DELETE FROM userstates WHERE id = ?").run(stateId).changes > 0;
    }

    /**
     * @param {State} state
     * @returns {void}
     */
    pushSpaceState(state: State): void {
        this.db
            .prepare("INSERT INTO states (open, changedby, date) VALUES (?, ?, ?)")
            .run(state.open ? 1 : 0, state.changedby, state.date.valueOf());
    }

    /**
     * @param {UserState} state
     * @returns {void}
     */
    pushPeopleState(state: UserState): void {
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

export default new StatusRepository();
