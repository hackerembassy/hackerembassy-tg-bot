const BaseRepository = require("./baseRepository");
const config = require('config');
const currencyConfig = config.get("currency");

class FundsRepository extends BaseRepository {
  getFunds() {
    return this.db.prepare("SELECT * FROM funds").all();
  }

  getFundByName(fundName) {
    return this.db
      .prepare("SELECT * FROM funds WHERE name = ?")
      .get(fundName);
  }

  getFundById(id) {
    return this.db
      .prepare("SELECT * FROM funds WHERE id = ?")
      .get(id);
  }

  getLatestCosts(){
    return this.getFunds().find(fund => /(А|а)ренда/.test(fund.name) && (fund.status === "open" || fund.status === ""));
  }

  getDonations() {
    return this.db.prepare("SELECT * FROM donations").all();
  }

  getDonationsForId(fundId) {
    return this.db
      .prepare("SELECT * FROM donations WHERE fund_id = ?")
      .all(fundId);
  }

  getDonationsForName(fundName) {
    return this.db
      .prepare("SELECT * FROM donations WHERE fund_id = (SELECT id from funds where name = ?)")
      .all(fundName);
  }

  getDonationById(donationId) {
    return this.db
      .prepare("SELECT * FROM donations WHERE id = ?")
      .get(donationId);
  }

  addFund(fundName, target, currency = currencyConfig.default, status = "open") {
    try {
      if (this.getFundByName(fundName) !== undefined) throw new Error(`Fund ${fundName} already exists`);

      if (!currency) throw new Error(`Invalid currency ${currency}`);

      this.db
        .prepare(
          "INSERT INTO funds (id, name, target_value, target_currency, status) VALUES (NULL, ?, ?, ?, ?)"
        )
        .run(fundName, target, currency, status);

      return true;
    }
    catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  updateFund(fundName, target, currency = currencyConfig.default, newFundName = fundName) {
    try {
      let fund = this.getFundByName(fundName);

      if (!fund) throw new Error(`Fund ${fundName} not found`);
      if (!currency) throw new Error(`Invalid currency ${currency}`);

      this.db
        .prepare(
          "UPDATE funds SET name = ?, target_value = ?, target_currency = ? WHERE id = ?"
        )
        .run(newFundName, target, currency, fund.id);

      return true;
    }
    catch (error) {
      this.logger.error(error);
      return false;
    }
  }
  
  removeFund(fundName) {
    try {
      if (!this.getFundByName(fundName)) throw new Error(`Fund ${fundName} not found`);

      this.db.prepare("DELETE FROM funds WHERE name = ?").run(fundName);
      return true;
    }
    catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  closeFund(fundName) {
    return this.changeFundStatus(fundName, "closed");
  }

  changeFundStatus(fundName, status) {
    try {
      if (!this.getFundByName(fundName)) throw new Error(`Fund ${fundName} not found`);

      this.db
        .prepare("UPDATE funds SET status = ? WHERE name = ?")
        .run(status, fundName);

      return true;
    }
    catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  addDonationTo(fundName, username, value, currency = currencyConfig.default, accountant = null) {
    try {
      let fundId = this.getFundByName(fundName)?.id;

      if (!fundId) throw new Error(`Fund ${fundName} not found`);
      if (!currency) throw new Error(`Invalid currency ${currency}`);

      this.db
        .prepare(
          "INSERT INTO donations (fund_id, username, value, currency, accountant) VALUES (?, ?, ?, ?, ?)"
        )
        .run(fundId, username, value, currency, accountant);

      return true;
    }
    catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  updateDonation(donationId, value, currency) {
    try {
      if (!this.getDonationById(donationId)) throw new Error(`Donation with id ${donationId} not found`);
      if (!currency) throw new Error(`Invalid currency ${currency}`);;

      this.db.prepare("UPDATE donations SET value = ?, currency = ? WHERE id = ?").run(value, currency, donationId);

      return true;
    }
    catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  transferDonation(id, accountant) {
    try {
      if (!this.getDonationById(id)) throw new Error(`Donation with id ${id} not found`);

      this.db
        .prepare("UPDATE donations SET accountant = ? WHERE id = ?")
        .run(accountant, id);

      return true;
    }
    catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  removeDonationById(donationId) {
    try {
      if (!this.getDonationById(donationId)) throw new Error(`Donation with id ${donationId} not found`);

      this.db.prepare("DELETE FROM donations WHERE id = ?").run(donationId);

      return true;
    }
    catch (error) {
      this.logger.error(error);
      return false;
    }
  }
}

module.exports = new FundsRepository();
