import State from "@models/State";
import UserState, { UserStateType } from "@models/UserState";

import BaseRepository from "./base";

class StatusRepository extends BaseRepository {
    getSpaceLastState(): Nullable<State> {
        const lastState = this.db.prepare("SELECT * FROM states ORDER BY date DESC").get() as Optional<State>;

        if (!lastState) return null;

        lastState.date = new Date(lastState.date);

        return lastState;
    }

    getAllUserStates(): UserState[] {
        return this.db.prepare("SELECT * FROM userstates ORDER BY date DESC").all() as UserState[];
    }

    getUserStates(username: string, fromDate: number = 0, toDate: number = Date.now()): UserState[] {
        return this.db
            .prepare("SELECT * FROM userstates WHERE LOWER(username) = ? AND date BETWEEN ? AND ? ORDER BY date")
            .all(username.toLowerCase(), fromDate, toDate) as UserState[];
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

    /**
     * @deprecated use UserStateService.pushPeopleState instead
     */
    pushPeopleState(state: UserState): void {
        this.db
            .prepare("INSERT INTO userstates (status, username, date, until, type, note) VALUES (?, ?, ?, ?, ?, ?)")
            .run(
                state.status ? state.status : UserStateType.Outside,
                state.username,
                state.date.valueOf(),
                state.until ? state.until.valueOf() : null,
                state.type,
                state.note
            );
    }
}

export default new StatusRepository();
