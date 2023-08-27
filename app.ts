import { config } from "dotenv";
config();
import("./bot/bot-instance");
import("./botApi");

process.env.TZ = require("config").get("bot").timezone;
