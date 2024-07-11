import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

import * as schema from "./schema";
import * as relations from "./relations";

export const sqlite = new Database("./data/db/data.db");
const db = drizzle(sqlite, { schema: { ...schema, ...relations } });

export default db;
