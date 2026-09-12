import path from "node:path";

import { PROJECT_ROOT } from "@utils/filesystem";

import { getOrCreateDb } from "./scripts";

const db = getOrCreateDb(path.join(PROJECT_ROOT, "db/data.db"), true);

export default db;
