import { and, eq, isNull } from "drizzle-orm";

import { needs } from "@data/schema";

import BaseRepository from "./base";

class NeedsRepository extends BaseRepository {
    getNeedById(id: number) {
        return this.db.select().from(needs).where(eq(needs.id, id)).get();
    }

    getOpenNeedByItem(item: string) {
        return this.db
            .select()
            .from(needs)
            .where(and(eq(needs.item, item), isNull(needs.buyer_id)))
            .get();
    }

    getOpenNeeds() {
        return this.db.query.needs
            .findMany({
                where: isNull(needs.buyer_id),
                orderBy: needs.id,
                with: {
                    requester: true,
                },
            })
            .sync();
    }

    addBuy(item: string, requesterId: number, date: Date): boolean {
        return this.db.insert(needs).values({ item, requester_id: requesterId, updated: date.valueOf() }).run().changes > 0;
    }

    closeNeed(id: number, buyerId: number, date: Date): boolean {
        return (
            this.db.update(needs).set({ buyer_id: buyerId, updated: date.valueOf() }).where(eq(needs.id, id)).run().changes > 0
        );
    }

    undoClose(id: number): boolean {
        return this.db.update(needs).set({ buyer_id: null, updated: null }).where(eq(needs.id, id)).run().changes > 0;
    }
}

export default new NeedsRepository();
