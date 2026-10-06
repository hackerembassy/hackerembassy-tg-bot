import { and, desc, eq, ne, sql, sum } from "drizzle-orm";

import { HackemcoinTransaction } from "@data/models";
import { hackemcoinBalances, hackemcoinTransactions } from "@data/schema";

import BaseRepository from "./base";

export type NewHackemcoinTransaction = Omit<HackemcoinTransaction, "id" | "date"> & { date?: Date };

class HackemcoinsRepository extends BaseRepository {
    getBalance(userId: number): number {
        return (
            this.db
                .select({ balance: hackemcoinBalances.balance })
                .from(hackemcoinBalances)
                .where(eq(hackemcoinBalances.user_id, userId))
                .get()?.balance ?? 0
        );
    }

    getTransactionById(id: number) {
        return this.db.select().from(hackemcoinTransactions).where(eq(hackemcoinTransactions.id, id)).get();
    }

    getTransactionsOf(userId: number, limit: number) {
        return this.db.query.hackemcoinTransactions
            .findMany({
                where: and(eq(hackemcoinTransactions.user_id, userId), ne(hackemcoinTransactions.amount, 0)),
                orderBy: desc(hackemcoinTransactions.id),
                limit,
                with: { snack: true },
            })
            .sync();
    }

    getTransactionReferencing(refId: number) {
        return this.db.select().from(hackemcoinTransactions).where(eq(hackemcoinTransactions.ref_id, refId)).get();
    }

    getDonationReward(donationId: number) {
        return this.db
            .select()
            .from(hackemcoinTransactions)
            .where(and(eq(hackemcoinTransactions.donation_id, donationId), eq(hackemcoinTransactions.type, "donation")))
            .get();
    }

    getDonationRewardTotal(donationId: number): number {
        const result = this.db
            .select({ total: sum(hackemcoinTransactions.amount) })
            .from(hackemcoinTransactions)
            .where(eq(hackemcoinTransactions.donation_id, donationId))
            .get();

        return Number(result?.total ?? 0);
    }

    // Journal entry and balance change always land together or not at all
    addTransaction(entry: NewHackemcoinTransaction): { transaction: HackemcoinTransaction; balance: number } {
        return this.db.transaction(tx => {
            const transaction = tx
                .insert(hackemcoinTransactions)
                .values({ ...entry, date: entry.date ?? new Date() })
                .returning()
                .get();

            const { balance } = tx
                .insert(hackemcoinBalances)
                .values({ user_id: entry.user_id, balance: entry.amount })
                .onConflictDoUpdate({
                    target: hackemcoinBalances.user_id,
                    set: { balance: sql`${hackemcoinBalances.balance} + ${entry.amount}` },
                })
                .returning({ balance: hackemcoinBalances.balance })
                .get();

            return { transaction, balance };
        });
    }
}

export default new HackemcoinsRepository();
