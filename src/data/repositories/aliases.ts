import { eq } from "drizzle-orm";

import { aliases } from "@data/schema";

import BaseRepository from "./base";

class AliasesRepository extends BaseRepository {
    getAliases() {
        return this.db.select().from(aliases).all();
    }

    getAliasByName(alias: string) {
        return this.db.select().from(aliases).where(eq(aliases.alias, alias)).get();
    }

    upsertAlias(alias: string, target: string, createdBy: number) {
        return this.db
            .insert(aliases)
            .values({ alias, target, created_by: createdBy })
            .onConflictDoUpdate({ target: aliases.alias, set: { target, created_by: createdBy } })
            .run();
    }

    removeAlias(alias: string) {
        return this.db.delete(aliases).where(eq(aliases.alias, alias)).run();
    }
}

export default new AliasesRepository();
