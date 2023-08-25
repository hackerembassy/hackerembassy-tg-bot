/**
 * @typedef {import("../data/db")} Database
 */
const SQLiteDBWrapper = require("../data/db");
const logger = require("../services/logger");

class BaseRepository {
    /**
     * @param {Database} dBWrapper
     */
    constructor(dBWrapper = SQLiteDBWrapper) {
        this.db = dBWrapper ?? SQLiteDBWrapper;
        this.logger = logger;
    }
}

module.exports = BaseRepository;
