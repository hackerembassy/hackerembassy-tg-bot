import BetterSqlite3 from "better-sqlite3";
import winston from "winston";

import SQLiteDBWrapper from "../data/db";
import defaultLogger from "../services/logger";

abstract class BaseRepository {
    constructor(protected db: BetterSqlite3.Database = SQLiteDBWrapper, protected logger: winston.Logger = defaultLogger) {}
}

export default BaseRepository;
