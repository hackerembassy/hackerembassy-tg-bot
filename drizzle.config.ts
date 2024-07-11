import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "sqlite",
    out: "./data/migrations",
    schema: "./data/schema.ts",
    dbCredentials: {
        url: "./data/db/data.db",
    },
    verbose: true,
    strict: true,
});
