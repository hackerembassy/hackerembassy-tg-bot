// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Donation = require("../models/Donation");
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Fund = require("../models/Fund");
const BaseRepository = require("./baseRepository");
const config = require("config");
const currencyConfig = config.get("currency");

class FundsRepository extends BaseRepository {
    /**
     * @returns {Fund[]}
     */
    getFunds() {
        return /** @type {Fund[]} */ (this.db.prepare("SELECT * FROM funds").all());
    }

    /**
     * @param {string} fundName
     * @returns {Fund}
     */
    getFundByName(fundName) {
        return /** @type {Fund} */ (this.db.prepare("SELECT * FROM funds WHERE name = ?").get(fundName));
    }

    /**
     * @param {number} id
     * @returns {Fund}
     */
    getFundById(id) {
        return /** @type {Fund} */ (this.db.prepare("SELECT * FROM funds WHERE id = ?").get(id));
    }

    /**
     * @returns {Fund}
     */
    getLatestCosts() {
        return /** @type {Fund} */ (
            this.getFunds().find(fund => /(А|а)ренда/.test(fund.name) && (fund.status === "open" || fund.status === ""))
        );
    }

    /**
     * @returns {Donation[]}
     */
    getDonations() {
        return /** @type {Donation[]} */ (this.db.prepare("SELECT * FROM donations").all());
    }

    /**
     * @param {number} fundId
     * @returns {Donation[]}
     */
    getDonationsForId(fundId) {
        return /** @type {Donation[]} */ (this.db.prepare("SELECT * FROM donations WHERE fund_id = ?").all(fundId));
    }

    /**
     * @param {string} fundName
     * @returns {Donation[]}
     */
    getDonationsForName(fundName) {
        return /** @type {Donation[]} */ (
            this.db.prepare("SELECT * FROM donations WHERE fund_id = (SELECT id from funds where name = ?)").all(fundName)
        );
    }

    /**
     * @param {number} donationId
     * @returns {Donation}
     */
    getDonationById(donationId) {
        return /** @type {Donation} */ (this.db.prepare("SELECT * FROM donations WHERE id = ?").get(donationId));
    }

    /**
     * @param {string} fundName
     * @param {number} target
     * @param {string} currency
     * @param {string} status
     * @returns {boolean}
     */
    addFund(fundName, target, currency = currencyConfig.default, status = "open") {
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

    /**
     * @param {string} fundName
     * @param {number} target
     * @param {string} currency
     * @param {string} newFundName
     * @returns {boolean}
     */
    updateFund(fundName, target, currency = currencyConfig.default, newFundName = fundName) {
        try {
            let fund = this.getFundByName(fundName);

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

    /**
     * @param {string} fundName
     * @returns {boolean}
     */
    removeFund(fundName) {
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
     * @param {string} fundName
     * @returns {boolean}
     */
    closeFund(fundName) {
        return this.changeFundStatus(fundName, "closed");
    }

    /**
     * @param {string} fundName
     * @param {string} status
     * @returns {boolean}
     */
    changeFundStatus(fundName, status) {
        try {
            if (!this.getFundByName(fundName)) throw new Error(`Fund ${fundName} not found`);

            this.db.prepare("UPDATE funds SET status = ? WHERE name = ?").run(status, fundName);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     * @param {string} fundName
     * @param {string} username
     * @param {number} value
     * @param {string} currency
     * @param {string} accountant
     * @returns {boolean}
     */
    addDonationTo(fundName, username, value, currency = currencyConfig.default, accountant = null) {
        try {
            let fundId = this.getFundByName(fundName)?.id;

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

    /**
     * @param {number} donationId
     * @param {number} value
     * @param {string} currency
     * @returns {boolean}
     */
    updateDonation(donationId, value, currency) {
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

    /**
     * @param {number} id
     * @param {string} accountant
     * @returns {boolean}
     */
    transferDonation(id, accountant) {
        try {
            if (!this.getDonationById(id)) throw new Error(`Donation with id ${id} not found`);

            this.db.prepare("UPDATE donations SET accountant = ? WHERE id = ?").run(accountant, id);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     * @param {number} donationId
     * @returns {boolean}
     */
    removeDonationById(donationId) {
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

module.exports = new FundsRepository();
