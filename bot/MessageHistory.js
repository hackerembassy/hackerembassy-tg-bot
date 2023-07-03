const fs = require("fs");
const path = require("path");
const botConfig = require("config").get("bot");

class MessageHistory {
    constructor() {
        /**
         * @type {string}
         */
        this.historypath = path.join(botConfig.persistedfolderpath, "history.json");

        if (fs.existsSync(this.historypath)) {
            this.#historyBuffer = JSON.parse(fs.readFileSync(this.historypath).toString());
        } else {
            this.#historyBuffer = {};
            fs.writeFileSync(this.historypath, JSON.stringify(this.#historyBuffer));
        }
    }

    /**
     * @param {string | number} chatId
     * @param {string} messageId
     * @param {string | undefined} text
     */
    async push(chatId, messageId, text = undefined) {
        if (!this.#historyBuffer[chatId]) this.#historyBuffer[chatId] = [];
        if (this.#historyBuffer[chatId].length >= botConfig.maxchathistory) this.#historyBuffer[chatId].shift();

        this.#historyBuffer[chatId].push({ messageId, text, datetime: Date.now() });
        await this.#persistChanges();
    }

    /**
     * @param {number} chatId
     * @param {number} count
     * @param {number | undefined} startMessageId
     */
    async *pop(chatId, count = 1, startMessageId = undefined) {
        if (!this.#historyBuffer[chatId] || this.#historyBuffer[chatId].length === 0) return [];

        // Going from the end by default
        let from = -1;

        if (startMessageId) {
            from = this.#historyBuffer[chatId].findIndex(x => x.messageId === startMessageId);
            // No such message in history? Do nothing!
            if (from === -1) return [];
        }

        for (let index = 0; index < count; index++) {
            const removedElement = this.#historyBuffer[chatId].splice(from, 1)[0];

            yield removedElement;

            if (from > 0) from--;
            else if (from === 0) break;
        }

        await this.#persistChanges();
    }

    /**
     * @type {{ [chatId: string]: { messageId: any; text?: any; datetime: number }[]; }}
     */
    #historyBuffer;

    async #persistChanges() {
        await fs.promises.writeFile(this.historypath, JSON.stringify(this.#historyBuffer));
    }
}

module.exports = MessageHistory;
