const IsDebug = process.env["BOTDEBUG"] === "true";

const Database = require("better-sqlite3");
const options = IsDebug ? { verbose: console.log } : undefined;

const db = new Database("./data/data.db", options);

module.exports = db;
