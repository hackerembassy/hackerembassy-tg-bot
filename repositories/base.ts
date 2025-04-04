import winston from "winston";

import defaultLogger from "@services/common/logger";

import drizzleClient from "../data/db";

abstract class BaseRepository {
    constructor(
        protected db = drizzleClient,
        protected logger: winston.Logger = defaultLogger
    ) {}
}

export default BaseRepository;
