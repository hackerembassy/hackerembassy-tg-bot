import config from "config";

import { CurrencyConfig } from "@config";
import Donation, { FundDonation } from "@models/Donation";
import Fund from "@models/Fund";

import BaseRepository from "./base";

const currencyConfig = config.get<CurrencyConfig>("currency");

type DonationExport = {
    donationId: number;
    amount: number;
    currency: string;
    from: string;
    fund: string;
};

export const COSTS_PREFIX = "Аренда";

class FundsRepository extends BaseRepository {
    getFunds(): Nullable<Fund[]> {
        return this.db.prepare("SELECT * FROM funds").all() as Nullable<Fund[]>;
    }

    getFundByName(fundName: string): Nullable<Fund> {
        return this.db.prepare("SELECT * FROM funds WHERE name = ?").get(fundName) as Nullable<Fund>;
    }

    getFundById(id: number): Nullable<Fund> {
        return this.db.prepare("SELECT * FROM funds WHERE id = ?").get(id) as Nullable<Fund>;
    }

    getLatestCosts(): Fund | undefined {
        return this.getFunds()?.find(fund => /[Аа]ренда/.test(fund.name) && (fund.status === "open" || fund.status === ""));
    }

    getDonations(): Nullable<Donation[]> {
        return this.db.prepare("SELECT * FROM donations").all() as Nullable<Donation[]>;
    }

    getDonationsForId(fundId: number): Nullable<Donation[]> {
        return this.db.prepare("SELECT * FROM donations WHERE fund_id = ?").all(fundId) as Donation[];
    }

    getDonationsForName(fundName: string): Nullable<Donation[]> {
        return this.db
            .prepare("SELECT * FROM donations WHERE fund_id = (SELECT id from funds where name = ?)")
            .all(fundName) as Nullable<Donation[]>;
    }

    getDonationsOf(username: string): Nullable<Donation[]> {
        return this.db.prepare("SELECT * FROM donations WHERE username = ?").all(username) as Nullable<Donation[]>;
    }

    getFundDonations(): Nullable<FundDonation[]> {
        return this.db
            .prepare("SELECT d.id, d.username, d.value, d.currency, f.name FROM donations d JOIN funds f on d.fund_id = f.id")
            .all() as Nullable<FundDonation[]>;
    }

    getCostsFundDonations(year?: number): Nullable<FundDonation[]> {
        return this.db
            .prepare(
                "SELECT d.id, d.username, d.value, d.currency, f.name FROM donations d JOIN funds f on d.fund_id = f.id WHERE f.name LIKE ? || '%' || ?"
            )
            .all(COSTS_PREFIX, year ? year.toString() : "%") as Nullable<FundDonation[]>;
    }

    getFundDonationsOf(username: string): Nullable<FundDonation[]> {
        return this.db
            .prepare(
                "SELECT d.id, d.username, d.value, d.currency, f.name FROM donations d JOIN funds f on d.fund_id = f.id WHERE LOWER(d.username) = ? ORDER BY d.fund_id"
            )
            .all(username.toLowerCase()) as Nullable<FundDonation[]>;
    }

    // TODO there should be a better way
    getFundDonationsHeldBy(accountant: string, fundName?: string): Nullable<FundDonation[]> {
        return this.db
            .prepare(
                "SELECT d.id, d.username, d.value, d.currency, f.name FROM donations d JOIN funds f on d.fund_id = f.id WHERE LOWER(d.accountant) = ? AND f.name LIKE ?"
            )
            .all(accountant.toLowerCase(), fundName && fundName.length > 0 ? fundName : "%") as Nullable<FundDonation[]>;
    }

    getDonationById(donationId: number): Nullable<Donation> {
        return this.db.prepare("SELECT * FROM donations WHERE id = ?").get(donationId) as Nullable<Donation>;
    }

    exportDonations(): DonationExport[] {
        return this.db
            .prepare(
                `SELECT d.id as 'donationId', d.value as 'amount', d.currency as 'currency', d.username as 'from', f.name as 'fund' \
                FROM donations d \
                JOIN funds f ON d.fund_id = f.id \
                ORDER BY f.id`
            )
            .all() as DonationExport[];
    }

    addFund(fundName: string, target: number, currency: string = currencyConfig.default, status: string = "open"): boolean {
        try {
            if (this.getFundByName(fundName)) throw new Error(`Fund ${fundName} already exists`);

            if (!currency) throw new Error(`Invalid currency ${currency}`);

            this.db
                .prepare("INSERT INTO funds (id, name, target_value, target_currency, status) VALUES (NULL, ?, ?, ?, ?)")
                .run(fundName, target, currency, status);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    updateFund(
        fundName: string,
        target: number,
        currency: string = currencyConfig.default,
        newFundName: string = fundName
    ): boolean {
        try {
            const fund = this.getFundByName(fundName);

            if (!fund) throw new Error(`Fund ${fundName} not found`);
            if (!currency) throw new Error(`Invalid currency ${currency}`);

            this.db
                .prepare("UPDATE funds SET name = ?, target_value = ?, target_currency = ? WHERE id = ?")
                .run(newFundName, target, currency, fund.id);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    removeFund(fundName: string): boolean {
        try {
            if (!this.getFundByName(fundName)) throw new Error(`Fund ${fundName} not found`);

            this.db.prepare("DELETE FROM funds WHERE name = ?").run(fundName);
            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     * @deprecated Use for tests only
     */
    clearFunds(): boolean {
        try {
            this.db.prepare("DELETE FROM funds WHERE id = id").run();
            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    closeFund(fundName: string): boolean {
        return this.changeFundStatus(fundName, "closed");
    }

    changeFundStatus(fundName: string, status: string): boolean {
        try {
            if (!this.getFundByName(fundName)) throw new Error(`Fund ${fundName} not found`);

            this.db.prepare("UPDATE funds SET status = ? WHERE name = ?").run(status, fundName);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    addDonationTo(
        fundName: string,
        username: string,
        value: number,
        currency: string = currencyConfig.default,
        accountant: Nullable<string> = null
    ): boolean {
        try {
            const fundId = this.getFundByName(fundName)?.id;

            if (!fundId) throw new Error(`Fund ${fundName} not found`);
            if (!currency) throw new Error(`Invalid currency ${currency}`);

            this.db
                .prepare("INSERT INTO donations (fund_id, username, value, currency, accountant) VALUES (?, ?, ?, ?, ?)")
                .run(fundId, username, value, currency, accountant);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    updateDonationValues(donationId: number, value: number, currency: string): boolean {
        try {
            if (!this.getDonationById(donationId)) throw new Error(`Donation with id ${donationId} not found`);
            if (!currency) throw new Error(`Invalid currency ${currency}`);

            this.db.prepare("UPDATE donations SET value = ?, currency = ? WHERE id = ?").run(value, currency, donationId);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    updateDonation(donation: Donation): boolean {
        try {
            this.db
                .prepare("UPDATE donations SET value = ?, currency = ?, accountant = ?, username = ?, fund_id = ? WHERE id = ?")
                .run(donation.value, donation.currency, donation.accountant, donation.username, donation.fund_id, donation.id);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    transferDonation(id: number, accountant: string): boolean {
        try {
            if (!this.getDonationById(id)) throw new Error(`Donation with id ${id} not found`);

            this.db.prepare("UPDATE donations SET accountant = ? WHERE id = ?").run(accountant, id);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    removeDonationById(donationId: number): boolean {
        try {
            if (!this.getDonationById(donationId)) throw new Error(`Donation with id ${donationId} not found`);

            this.db.prepare("DELETE FROM donations WHERE id = ?").run(donationId);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }
}

export default new FundsRepository();
