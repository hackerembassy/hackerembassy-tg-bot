import config from "config";

import { and, eq } from "drizzle-orm";

import { CurrencyConfig } from "@config";
import { Fund, Donation } from "@data/models";
import { donations, funds } from "@data/schema";

import BaseRepository from "./base";

const currencyConfig = config.get<CurrencyConfig>("currency");

type DonationExport = {
    donationId: number;
    amount: number;
    currency: string;
    from: number;
    fund: string;
};

export const COSTS_PREFIX = "Аренда";

class FundsRepository extends BaseRepository {
    getAllFunds() {
        return this.db.select().from(funds).all();
    }

    getFundByName(fundName: string) {
        return this.db.select().from(funds).where(eq(funds.name, fundName)).get();
    }

    getFundById(id: number) {
        return this.db.select().from(funds).where(eq(funds.id, id)).get();
    }

    getAllDonations(joinFunds = false, joinUsers = false) {
        return this.db.query.donations
            .findMany({
                with: {
                    fund: joinFunds ? true : undefined,
                    user: joinUsers ? true : undefined,
                    accountant: joinUsers ? true : undefined,
                },
            })
            .sync();
    }

    getDonationsForFundId(fundId: number, joinFunds = false, joinUsers = false) {
        return this.db.query.donations
            .findMany({
                where: eq(donations.fund_id, fundId),
                with: {
                    fund: joinFunds ? true : undefined,
                    user: joinUsers ? true : undefined,
                    accountant: joinUsers ? true : undefined,
                },
            })
            .sync();
    }

    getDonationsForName(fundName: string) {
        const fund = this.getFundByName(fundName);

        if (!fund) return [];

        return this.db.select().from(donations).where(eq(donations.fund_id, fund.id)).all();
    }

    getDonationsOf(user_id: number, joinFunds = false, joinUsers = false) {
        return this.db.query.donations
            .findMany({
                where: eq(donations.user_id, user_id),
                with: {
                    fund: joinFunds ? true : undefined,
                    user: joinUsers ? true : undefined,
                    accountant: joinUsers ? true : undefined,
                },
            })
            .sync();
    }

    getLatestCosts(): Fund | undefined {
        return this.getAllFunds().find(fund => /[Аа]ренда/.test(fund.name) && (fund.status === "open" || fund.status === ""));
    }

    getCostsFundDonations(year?: number) {
        return this.getAllDonations(true).filter(
            donation => donation.fund.name.startsWith(COSTS_PREFIX) && (!year || donation.fund.name.includes(year.toString()))
        );
    }

    getFundDonationsHeldBy(accountant_id: number, fund_id?: number) {
        return this.db.query.donations
            .findMany({
                where: and(eq(donations.accountant_id, accountant_id), fund_id ? eq(donations.fund_id, fund_id) : undefined),
                with: {
                    fund: true,
                    accountant: true,
                    user: true,
                },
            })
            .sync();
    }

    getDonationById(donationId: number, joinFunds = false, joinUsers = false) {
        return this.db.query.donations
            .findFirst({
                where: eq(donations.id, donationId),
                with: {
                    fund: joinFunds ? true : undefined,
                    user: joinUsers ? true : undefined,
                    accountant: joinUsers ? true : undefined,
                },
            })
            .sync();
    }

    exportDonations(): DonationExport[] {
        return this.getAllDonations(true).map(donation => ({
            donationId: donation.id,
            amount: donation.value,
            currency: donation.currency,
            from: donation.user_id,
            fund: donation.fund.name,
        }));
    }

    addFund(fund: Omit<Fund, "id">): boolean {
        return this.db.insert(funds).values(fund).run().changes > 0;
    }

    updateFund(fund: Fund): boolean {
        return this.db.update(funds).set(fund).where(eq(funds.id, fund.id)).run().changes > 0;
    }

    removeFundByName(fundName: string) {
        return this.db.delete(funds).where(eq(funds.name, fundName)).run().changes > 0;
    }

    /**
     * @deprecated Use for tests only
     */
    clearFunds(): boolean {
        return this.db.delete(funds).where(eq(funds.id, funds.id)).run().changes > 0;
    }

    addDonation(donation: Omit<Donation, "id">): boolean {
        return this.db.insert(donations).values(donation).run().changes > 0;
    }

    addDonationTo(
        fund_id: number,
        user_id: number,
        value: number,
        currency: string = currencyConfig.default,
        accountant_id: number
    ): boolean {
        return this.addDonation({
            fund_id,
            user_id,
            value,
            currency,
            accountant_id,
        });
    }

    updateDonation(donation: Donation): boolean {
        return this.db.update(donations).set(donation).where(eq(donations.id, donation.id)).run().changes > 0;
    }

    closeFund(fundName: string): boolean {
        return this.changeFundStatus(fundName, "closed");
    }

    changeFundStatus(fundName: string, status: string): boolean {
        return this.db.update(funds).set({ status }).where(eq(funds.name, fundName)).run().changes > 0;
    }

    transferDonation(id: number, accountant_id: number): boolean {
        return this.db.update(donations).set({ accountant_id }).where(eq(donations.id, id)).run().changes > 0;
    }

    removeDonationById(donationId: number) {
        return this.db.delete(donations).where(eq(donations.id, donationId)).run().changes > 0;
    }
}

export default new FundsRepository();
