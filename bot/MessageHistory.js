const fs = require("fs");
const path = require("path");
const botConfig = require("config").get("bot");

class MessageHistory {
    constructor() {
        /**
         * @type {string}
         */
        this.historypath = path.join(botConfig.persistedfolderpath, "history.json");

        if (fs.existsSync(botConfig.historypath)) {
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
     * @param {string | number} chatId
     */
    async *pop(chatId, count = 1) {
        for (let index = 0; index < count; index++) {
            if (!this.#historyBuffer[chatId] || this.#historyBuffer[chatId].length === 0) return [];
            yield this.#historyBuffer[chatId].pop();
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
