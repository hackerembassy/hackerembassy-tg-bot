const fs = require("fs");
const path = require("path");
const { debounce } = require("../utils/common");
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
     * @param {number} chatId
     * @param {number} messageId
     */
    orderOf(chatId, messageId) {
        return this.#historyBuffer[chatId].findIndex(x => x.messageId === messageId);
    }

    /**
     * @param {string | number} chatId
     * @param {string} messageId
     * @param {string | undefined} text
     */
    async push(chatId, messageId, text = undefined, order = 0) {
        if (!this.#historyBuffer[chatId]) this.#historyBuffer[chatId] = [];
        if (this.#historyBuffer[chatId].length >= botConfig.maxchathistory) this.#historyBuffer[chatId].pop();

        this.#historyBuffer[chatId].splice(order, 0, { messageId, text, datetime: Date.now() });

        await this.#persistChanges();
    }

    /**
     * @param {number} chatId
     * @param {number} from
     */
    async pop(chatId, from = 0) {
        if (!this.#historyBuffer[chatId] || this.#historyBuffer[chatId].length === 0) return;

        const removed = this.#historyBuffer[chatId].splice(from, 1)[0];
        this.#debouncedPersistChanges();

        return removed;
    }

    /**
     * @type {{ [chatId: string]: { messageId: any; text?: any; datetime: number }[]; }}
     */
    #historyBuffer;

    #debouncedPersistChanges = debounce(async function () {
        await this.#persistChanges();
    }, 1000);

    async #persistChanges() {
        await fs.promises.writeFile(this.historypath, JSON.stringify(this.#historyBuffer));
    }

    // TODO update history entry for EditMessage
}

module.exports = MessageHistory;
