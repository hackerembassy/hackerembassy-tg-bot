const BaseRepository = require("./baseRepository");
const config = require('config');
const currencyConfig = config.get("currency");

class FundsRepository extends BaseRepository {
  getfunds() {
    let funds = this.db.prepare("SELECT * FROM funds").all();

    return funds;
  }

  getfundByName(fundName) {
    return this.db
      .prepare("SELECT * FROM funds WHERE name = ?")
      .get(fundName);
  }

  getLatestCosts(){
    return this.getfunds().find(fund => /(А|а)ренда/.test(fund.name) && (fund.status === "open" || fund.status === ""));
  }

  getDonations() {
    return this.db.prepare("SELECT * FROM donations").all();
  }

  getDonationsForId(fundId) {
    let donations = this.db
      .prepare("SELECT * FROM donations WHERE fund_id = ?")
      .all(fundId);

    return donations;
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

  addfund(fundName, target, currency = currencyConfig.default, status = "open") {
    try {
      if (this.getfundByName(fundName) !== undefined) return false;

      this.db
        .prepare(
          "INSERT INTO funds (id, name, target_value, target_currency, status) VALUES (NULL, ?, ?, ?, ?)"
        )
        .run(fundName, target, currency, status);

      return true;
    }
    catch (error) {
      return false;
    }
  }

  updatefund(fundName, target, currency = currencyConfig.default, newFundName = fundName) {
    try {
      let fund = this.getfundByName(fundName);

      if (!fund) return false;

      this.db
        .prepare(
          "UPDATE funds SET name = ?, target_value = ?, target_currency = ? WHERE id = ?"
        )
        .run(newFundName, target, currency, fund.id);

      return true;
    }
    catch (error) {
      return false;
    }
  }
  
  removefund(fundName) {
    try {
      if (this.getfundByName(fundName) === null) return false;

      this.db.prepare("DELETE FROM funds WHERE name = ?").run(fundName);

      return true;
    }
    catch (error) {
      console.log(error);

      return false;
    }
  }

  closefund(fundName) {
    return this.changefundStatus(fundName, "closed");
  }

  changefundStatus(fundName, status) {
    try {
      if (this.getfundByName(fundName) === null) return false;

      this.db
        .prepare("UPDATE funds SET status = ? WHERE name = ?")
        .run(status, fundName);

      return true;
    }
    catch (error) {
      console.log(error);

      return false;
    }
  }

  addDonationTo(fundName, username, value, currency = currencyConfig.default) {
    try {
      let fundId = this.getfundByName(fundName)?.id;

      if (fundId === undefined) return false;

      this.db
        .prepare(
          "INSERT INTO donations (fund_id, username, value, currency) VALUES (?, ?, ?, ?)"
        )
        .run(fundId, username, value, currency);

      return true;
    }
    catch (error) {
      console.log(error);

      return false;
    }
  }

  removeDonationById(donationId) {
    try {
      if (this.getDonationById(donationId) === null) return false;

      this.db.prepare("DELETE FROM donations WHERE id = ?").run(donationId);

      return true;
    }
    catch (error) {
      console.log(error);

      return false;
    }
  }
}

module.exports = new FundsRepository();
