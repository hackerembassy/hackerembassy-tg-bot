import { desc, between, and, eq } from "drizzle-orm";

import { State, UserState } from "@data/models";

import { states, userstates } from "@data/schema";

import BaseRepository from "./base";

class StatusRepository extends BaseRepository {
    getSpaceLastState() {
        return this.db.query.states
            .findFirst({
                orderBy: desc(states.date),
                with: {
                    changer: true,
                },
            })
            .sync();
    }

    getAllUserStates() {
        return this.db.query.userstates
            .findMany({
                orderBy: desc(userstates.date),
                with: {
                    user: true,
                },
            })
            .sync();
    }

    getUserStates(userid: number, fromDate: number = 0, toDate: number = Date.now()): UserState[] {
        return this.db
            .select()
            .from(userstates)
            .where(and(eq(userstates.user_id, userid), between(userstates.date, fromDate, toDate)))
            .orderBy(desc(userstates.date))
            .all();
    }

    updateUserState(userState: UserState): boolean {
        return this.db.update(userstates).set(userState).where(eq(userstates.id, userState.id)).run().changes > 0;
    }

    removeUserState(stateId: number): boolean {
        return this.db.delete(userstates).where(eq(userstates.id, stateId)).run().changes > 0;
    }

    pushSpaceState(state: State): boolean {
        return this.db.insert(states).values(state).run().changes > 0;
    }

    /**
     * @deprecated use UserStateService.pushPeopleState instead
     */
    pushPeopleState(state: UserState): boolean {
        return this.db.insert(userstates).values(state).run().changes > 0;
    }
}

export default new StatusRepository();
