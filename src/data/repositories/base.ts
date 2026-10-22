import winston from "winston";

import defaultLogger from "@services/common/logger";

import drizzleClient from "@data/db";

abstract class BaseRepository {
    constructor(
        protected db = drizzleClient,
        protected logger: winston.Logger = defaultLogger
    ) {}
}

// better-sqlite3 runs everything on one connection, so repository calls made inside fn join the transaction (nested ones become savepoints)
export function runInTransaction<T>(fn: () => T): T {
    return drizzleClient.transaction(() => fn());
}

export default BaseRepository;
