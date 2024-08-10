/* eslint-disable no-console */
import path from "path";
import fs, { existsSync } from "fs";

import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";

import * as schema from "./schema";
import * as relations from "./relations";
import { SEED_SERVICE_USERS } from "./seed";
import { User } from "./models";

export function getOrCreateDb(
    shouldInit = process.env.NODE_ENV === "production",
    location: string = path.join(__dirname, "./db/data.db")
) {
    try {
        let isNewDatabase = false;

        if (!existsSync(location)) {
            if (!shouldInit)
                throw new Error(
                    "If you have started the app for the first time for development, please run 'npm run init' to create the database and setup the environment"
                );

            if (process.env.NODE_ENV !== "test") console.log("Database not found, creating a new one...");

            fs.mkdirSync(path.join(location, ".."), { recursive: true });
            isNewDatabase = true;
        }

        const db = new Database(location);
        const drizzleDb = drizzle(db, { schema: { ...schema, ...relations } });

        if (isNewDatabase) {
            migrate(drizzleDb, { migrationsFolder: path.join(__dirname, "./migrations") });
            seedUsers(SEED_SERVICE_USERS);
        }

        return drizzleDb;
    } catch (error) {
        console.error((error as Error).message);

        process.exit(1);
    }
}

export async function seedUsers(seedUsers: User[]) {
    const usersRepository = (await import("@repositories/users")).default;

    seedUsers.forEach(user => usersRepository.addUser(user.userid, user.username, user.roles?.split("|")));
}
