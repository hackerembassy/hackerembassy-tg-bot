const SQLiteDBWrapper = require("../data/db");
const logger = require("../services/logger");

class BaseRepository {
    constructor(dBWrapper) {
        this.db = dBWrapper ?? SQLiteDBWrapper;
        this.logger = logger;
    }
}

module.exports = BaseRepository;
