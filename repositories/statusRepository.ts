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

    getSpaceLastState(): State {
        const lastState = this.db.prepare("SELECT * FROM states ORDER BY date DESC").get() as State;

        if (!lastState) return null;

        lastState.date = new Date(lastState.date);

        return lastState;
    }

    getAllUserStates(): UserState[] {
        return this.db.prepare("SELECT * FROM userstates ORDER BY date DESC").all() as UserState[];
    }

    getUserStates(username: string, fromDate: number = 0, toDate: number = Date.now()): UserState[] {
        return this.db
            .prepare("SELECT * FROM userstates WHERE username = ? AND date BETWEEN ? AND ? ORDER BY date")
            .all(username, fromDate, toDate) as UserState[];
    }

    updateUserState(userState: UserState): boolean {
        return (
            this.db
                .prepare("UPDATE userstates SET username = ?, status = ?, date = ?, type = ?, note = ? WHERE id = ?")
                .run(userState.username, userState.status, userState.date, userState.type, userState.note, userState.id).changes >
            0
        );
    }

    removeUserState(stateId: number): boolean {
        return this.db.prepare("DELETE FROM userstates WHERE id = ?").run(stateId).changes > 0;
    }

    pushSpaceState(state: State): void {
        this.db
            .prepare("INSERT INTO states (open, changedby, date) VALUES (?, ?, ?)")
            .run(state.open ? 1 : 0, state.changedby, state.date.valueOf());
    }

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
