import Need from "../models/Need";
import BaseRepository from "./baseRepository";

class NeedsRepository extends BaseRepository {
    /**
     * @param {number} id
     *  @returns {Need}
     */
    getNeedById(id: number): Need {
        return /** @type {Need} */ this.db.prepare("SELECT * FROM needs WHERE id = ?").get(id) as Need;
    }

    /**
     * @param {string} text
     *  @returns {Need}
     */
    getOpenNeedByText(text: string): Need {
        return /** @type {Need} */ this.db
            .prepare("SELECT * FROM needs WHERE text = ? AND buyer IS NULL LIMIT 1")
            .get(text) as Need;
    }

    /**
     *  @returns {Need[]}
     */
    getOpenNeeds(): Need[] {
        return /** @type {Need[]} */ this.db.prepare("SELECT * FROM needs WHERE buyer IS NULL ORDER BY id ASC").all() as Need[];
    }

    /**
     * @param {string} text
     * @param {string} requester
     * @param {Date} date
     *  @returns {boolean}
     */
    addBuy(text: string, requester: string, date: Date): boolean {
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
    closeNeed(text: string, buyer: string, date: Date): boolean {
        try {
            const need = this.getOpenNeedByText(text);
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
    undoClose(id: number): boolean {
        try {
            const need = this.getNeedById(id);
            if (!need) return false;

            this.db.prepare("UPDATE needs SET buyer = NULL, updated = NULL WHERE id = ?").run(id);

            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }
}

export default new NeedsRepository();
