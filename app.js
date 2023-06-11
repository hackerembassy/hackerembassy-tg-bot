require("dotenv").config();
require("./bot/bot-instance");
require("./botApi");

process.env.TZ = require("config").get("bot").timezone;
