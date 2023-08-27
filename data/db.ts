import Database from "better-sqlite3";
const IsDebug = process.env["BOTDEBUG"] === "true";
const options = IsDebug ? { verbose: console.log } : undefined;
const db = new Database("./data/db/data.db", options);

export default db;
