import { and, eq, gt, isNull, lte } from "drizzle-orm";

import { DoorAccessGrant } from "@data/models";
import { doorAccessGrants } from "@data/schema";

import BaseRepository from "./base";

class DoorAccessRepository extends BaseRepository {
    addGrant(grant: Pick<DoorAccessGrant, "user_id" | "granted_by" | "starts_at" | "ends_at">): DoorAccessGrant {
        return this.db.insert(doorAccessGrants).values(grant).returning().get();
    }

    getActiveGrant(userId: number, at: Date) {
        return this.db
            .select()
            .from(doorAccessGrants)
            .where(
                and(
                    eq(doorAccessGrants.user_id, userId),
                    isNull(doorAccessGrants.revoked_at),
                    lte(doorAccessGrants.starts_at, at),
                    gt(doorAccessGrants.ends_at, at)
                )
            )
            .get();
    }

    revokeUnexpiredGrants(userId: number, revokerId: number, at: Date): DoorAccessGrant[] {
        return this.db
            .update(doorAccessGrants)
            .set({ revoked_by: revokerId, revoked_at: at })
            .where(
                and(eq(doorAccessGrants.user_id, userId), isNull(doorAccessGrants.revoked_at), gt(doorAccessGrants.ends_at, at))
            )
            .returning()
            .all()
            .toSorted((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
    }
}

export default new DoorAccessRepository();
