import Need from "../models/Need";
import BaseRepository from "./baseRepository";

class NeedsRepository extends BaseRepository {
    getNeedById(id: number): Need | null {
        return this.db.prepare("SELECT * FROM needs WHERE id = ?").get(id) as Need;
    }

    getOpenNeedByText(text: string): Need | null {
        return this.db.prepare("SELECT * FROM needs WHERE text = ? AND buyer IS NULL LIMIT 1").get(text) as Need;
    }

    getOpenNeeds(): Need[] | null {
        return this.db.prepare("SELECT * FROM needs WHERE buyer IS NULL ORDER BY id ASC").all() as Need[];
    }

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
