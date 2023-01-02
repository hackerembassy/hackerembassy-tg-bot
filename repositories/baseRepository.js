const SQLiteDBWrapper = require("../data/db");

class BaseRepository {
    constructor(dBWrapper){
        this.db = dBWrapper ?? SQLiteDBWrapper;
    }
}

module.exports = BaseRepository;