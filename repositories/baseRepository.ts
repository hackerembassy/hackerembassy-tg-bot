import BetterSqlite3 from "better-sqlite3";
import SQLiteDBWrapper from "../data/db";
import logger from "../services/logger";
import winston from "winston";

class BaseRepository {
    db: BetterSqlite3.Database;
    logger: winston.Logger;

    constructor(dBWrapper: BetterSqlite3.Database = SQLiteDBWrapper) {
        this.db = dBWrapper ?? SQLiteDBWrapper;
        this.logger = logger;
    }
}

export default BaseRepository;
