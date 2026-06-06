import { eq } from "drizzle-orm";

import { apikeys } from "@data/schema";
import { ApiKey } from "@data/models";

import BaseRepository from "./base";

class ApiKeyRepository extends BaseRepository {
    getKeyById(id: number) {
        return this.db.select().from(apikeys).where(eq(apikeys.id, id)).get();
    }

    getKeyByUser(userid: number) {
        return this.db.select().from(apikeys).where(eq(apikeys.user_id, userid)).get();
    }

    getUserByApiKey(key: string) {
        return this.db.query.apikeys
            .findFirst({
                where: eq(apikeys.key, key),
                with: {
                    user: true,
                },
            })
            .sync();
    }

    addKey(userid: number, key: string) {
        return (
            this.db
                .insert(apikeys)
                .values({
                    user_id: userid,
                    key,
                    created_at: Date.now(),
                })
                .run().changes > 0
        );
    }

    updateKeyLastUsed(id: number, last_used_at: number = Date.now()) {
        return (
            this.db
                .update(apikeys)
                .set({
                    last_used_at,
                })
                .where(eq(apikeys.id, id))
                .run().changes > 0
        );
    }

    updateKey(apikey: ApiKey) {
        return this.db.update(apikeys).set(apikey).where(eq(apikeys.id, apikey.id)).run().changes > 0;
    }

    removeKey(id: number) {
        return this.db.delete(apikeys).where(eq(apikeys.id, id)).run().changes > 0;
    }

    removeUserKey(userid: number) {
        return this.db.delete(apikeys).where(eq(apikeys.user_id, userid)).run().changes > 0;
    }
}

export default new ApiKeyRepository();
