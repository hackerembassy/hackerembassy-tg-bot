import BetterSqlite3 from "better-sqlite3";
import winston from "winston";

import defaultLogger from "@services/logger";

import SQLiteDBWrapper from "../data/db";

abstract class BaseRepository {
    constructor(
        protected db: BetterSqlite3.Database = SQLiteDBWrapper,
        protected logger: winston.Logger = defaultLogger
    ) {}
}

export default BaseRepository;
