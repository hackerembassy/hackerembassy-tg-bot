import { asc, eq, sql } from "drizzle-orm";

import { Snack } from "@data/models";
import { snacks } from "@data/schema";

import BaseRepository from "./base";

class SnacksRepository extends BaseRepository {
    getSnacks() {
        return this.db.select().from(snacks).where(eq(snacks.removed, false)).orderBy(asc(snacks.name)).all();
    }

    // Includes removed snacks so a re-added name revives its old row instead of hitting the unique index
    getSnackByName(name: string) {
        return this.db
            .select()
            .from(snacks)
            .where(sql`lower(${snacks.name}) = ${name.toLowerCase()}`)
            .get();
    }

    getSnackById(id: number) {
        return this.db.select().from(snacks).where(eq(snacks.id, id)).get();
    }

    addSnack(snack: Omit<Snack, "id" | "removed">): Snack {
        return this.db.insert(snacks).values(snack).returning().get();
    }

    updateSnack(id: number, snack: Partial<Omit<Snack, "id">>): Snack | undefined {
        return this.db.update(snacks).set(snack).where(eq(snacks.id, id)).returning().get();
    }

    changeStock(id: number, delta: number): Snack | undefined {
        return this.db
            .update(snacks)
            .set({ stock: sql`${snacks.stock} + ${delta}` })
            .where(eq(snacks.id, id))
            .returning()
            .get();
    }
}

export default new SnacksRepository();
