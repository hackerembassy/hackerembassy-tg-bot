const BaseRepository = require("./baseRepository");

class NeedsRepository extends BaseRepository {
  getNeedById(id) {
    return this.db.prepare("SELECT * FROM needs WHERE id = ?").get(id);
  }

  getOpenNeedByText(text) {
    return this.db.prepare("SELECT * FROM needs WHERE text = ? AND buyer IS NULL LIMIT 1").get(text);
  }

  getOpenNeeds() {
    let needs = this.db
      .prepare("SELECT * FROM needs WHERE buyer IS NULL ORDER BY id ASC")
      .all();

    return needs;
  }

  addBuy(text, requester, date) {
    try {

      if (this.getOpenNeedByText(text)) return false;

      this.db
        .prepare(
          "INSERT INTO needs (id, text, requester, updated, buyer) VALUES (NULL, ?, ?, ?, NULL)"
        )
        .run(text, requester, date.valueOf());

      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  closeNeed(text, buyer, date) {
    try {
      let need = this.getOpenNeedByText(text);
      if (!need) return false;

      this.db.prepare("UPDATE needs SET buyer = ?, updated = ? WHERE id = ?").run(buyer, date.valueOf(), need.id);

      return need.id;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  undoClose(id) {
    try {
      let need = this.getNeedById(id);
      if (!need) return false;

      this.db.prepare("UPDATE needs SET buyer = NULL, updated = NULL WHERE id = ?").run(id);

      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

}

module.exports = new NeedsRepository();
