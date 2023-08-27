// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Need = require("../models/Need");
const BaseRepository = require("./baseRepository");

class NeedsRepository extends BaseRepository {
    /**
     * @param {number} id
     *  @returns {Need}
     */
    getNeedById(id) {
        return /** @type {Need} */ (this.db.prepare("SELECT * FROM needs WHERE id = ?").get(id));
    }

    /**
     * @param {string} text
     *  @returns {Need}
     */
    getOpenNeedByText(text) {
        return /** @type {Need} */ (this.db.prepare("SELECT * FROM needs WHERE text = ? AND buyer IS NULL LIMIT 1").get(text));
    }

    /**
     *  @returns {Need[]}
     */
    getOpenNeeds() {
        return /** @type {Need[]} */ (this.db.prepare("SELECT * FROM needs WHERE buyer IS NULL ORDER BY id ASC").all());
    }

    /**
     * @param {string} text
     * @param {string} requester
     * @param {Date} date
     *  @returns {boolean}
     */
    addBuy(text, requester, date) {
        try {
            if (this.getOpenNeedByText(text)) return false;

            this.db
                .prepare("INSERT INTO needs (id, text, requester, updated, buyer) VALUES (NULL, ?, ?, ?, NULL)")
                .run(text, requester, date.valueOf());

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     * @param {string} text
     * @param {string} buyer
     * @param {Date} date
     *  @returns {boolean}
     */
    closeNeed(text, buyer, date) {
        try {
            let need = this.getOpenNeedByText(text);
            if (!need) return false;

            this.db.prepare("UPDATE needs SET buyer = ?, updated = ? WHERE id = ?").run(buyer, date.valueOf(), need.id);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     * @param {number} id
     *  @returns {boolean}
     */
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
