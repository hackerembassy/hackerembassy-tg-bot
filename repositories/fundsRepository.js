const BaseRepository = require("./baseRepository");

class FundsRepository extends BaseRepository {
  getfunds() {
    let funds = this.db.prepare("SELECT * FROM funds").all();
    return funds;
  }

  getfundByName(fundName) {
    let fund = this.db
      .prepare("SELECT * FROM funds WHERE name = ?")
      .get(fundName);
    return fund;
  }

  getDonations() {
    let donations = this.db.prepare("SELECT * FROM donations").all();
    return donations;
  }

  getDonationsForId(fundId) {
    let donations = this.db
      .prepare("SELECT * FROM donations WHERE fund_id = ?")
      .all(fundId);
    return donations;
  }

  getDonationsForName(fundName) {
    let donations = this.db
      .prepare("SELECT * FROM donations WHERE fund_id = (SELECT id from funds where name = ?)")
      .all(fundName);
    return donations;
  }

  getDonationById(donationId) {
    let donation = this.db
      .prepare("SELECT * FROM donations WHERE id = ?")
      .get(donationId);
    return donation;
  }

  addfund(fundName, target, currency = "AMD") {
    try {
      if (this.getfundByName(fundName) !== undefined) return false;
      this.db
        .prepare(
          "INSERT INTO funds (id, name, target_value, target_currency) VALUES (NULL, ?, ?, ?)"
        )
        .run(fundName, target, currency);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  removefund(fundName) {
    try {
      if (this.getfundByName(fundName) === null) return false;
      this.db.prepare("DELETE FROM funds WHERE name = ?").run(fundName);
      return true;
    } catch (error) {
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
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  addDonationTo(fundName, username, value, currency = "AMD") {
    try {
      let fundId = this.getfundByName(fundName)?.id;
      if (fundId === undefined) return false;
      this.db
        .prepare(
          "INSERT INTO donations (fund_id, username, value, currency) VALUES (?, ?, ?, ?)"
        )
        .run(fundId, username, value, currency);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  removeDonationById(donationId) {
    try {
      if (this.getDonationById(donationId) === null) return false;
      this.db.prepare("DELETE FROM donations WHERE id = ?").run(donationId);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
}

module.exports = new FundsRepository();
