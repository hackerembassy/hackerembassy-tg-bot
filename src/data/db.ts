import path from "node:path";

import { PROJECT_ROOT } from "@utils/filesystem";

import { getOrCreateDb } from "./scripts";

const db = getOrCreateDb(true, path.join(PROJECT_ROOT, "db/data.db"));

export default db;
