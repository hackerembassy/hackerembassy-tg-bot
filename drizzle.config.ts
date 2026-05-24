import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "sqlite",
    out: "./src/data/migrations",
    schema: "./src/data/schema.ts",
    dbCredentials: {
        url: "./db/data.db",
    },
    verbose: true,
    strict: true,
});
