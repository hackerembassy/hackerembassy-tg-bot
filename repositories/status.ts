import { desc, between, and, eq } from "drizzle-orm";

import { State, UserState } from "@data/models";
import { states, userstates } from "@data/schema";
import { DefaultState } from "@data/seed";

import BaseRepository from "./base";

class StatusRepository extends BaseRepository {
    getSpaceLastState() {
        return (
            this.db.query.states
                .findFirst({
                    orderBy: desc(states.date),
                    with: {
                        changer: true,
                    },
                })
                .sync() ?? DefaultState
        );
    }

    getAllUserStates(fromDate: number = 0, toDate: number = Date.now()) {
        return this.db.query.userstates
            .findMany({
                orderBy: desc(userstates.date),
                where: between(userstates.date, fromDate, toDate),
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

    pushSpaceState(state: Omit<State, "id">) {
        return this.db.insert(states).values(state).returning().get();
    }

    pushPeopleState(state: Omit<UserState, "id">) {
        return this.db.insert(userstates).values(state).returning().get();
    }
}

export default new StatusRepository();
