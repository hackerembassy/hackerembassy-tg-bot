import config from "config";

import { CurrencyConfig } from "../config/schema";
import Donation from "../models/Donation";
import Fund from "../models/Fund";
import BaseRepository from "./baseRepository";

const currencyConfig = config.get("currency") as CurrencyConfig;

class FundsRepository extends BaseRepository {
    getFunds(): Fund[] | null {
        return this.db.prepare("SELECT * FROM funds").all() as Fund[];
    }

    getFundByName(fundName: string): Fund | null {
        return this.db.prepare("SELECT * FROM funds WHERE name = ?").get(fundName) as Fund;
    }

    getFundById(id: number): Fund | null {
        return this.db.prepare("SELECT * FROM funds WHERE id = ?").get(id) as Fund;
    }

    getLatestCosts(): Fund | undefined {
        return this.getFunds()?.find(fund => /[Аа]ренда/.test(fund.name) && (fund.status === "open" || fund.status === ""));
    }

    getDonations(): Donation[] | null {
        return this.db.prepare("SELECT * FROM donations").all() as Donation[];
    }

    getDonationsForId(fundId: number): Donation[] | null {
        return this.db.prepare("SELECT * FROM donations WHERE fund_id = ?").all(fundId) as Donation[];
    }

    getDonationsForName(fundName: string): Donation[] | null {
        return this.db
            .prepare("SELECT * FROM donations WHERE fund_id = (SELECT id from funds where name = ?)")
            .all(fundName) as Donation[];
    }

    getDonationById(donationId: number): Donation | null {
        return this.db.prepare("SELECT * FROM donations WHERE id = ?").get(donationId) as Donation;
    }

    addFund(fundName: string, target: number, currency: string = currencyConfig.default, status: string = "open"): boolean {
        try {
            if (this.getFundByName(fundName) !== undefined) throw new Error(`Fund ${fundName} already exists`);

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
        accountant: string | null = null
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

    updateDonation(donationId: number, value: number, currency: string): boolean {
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
