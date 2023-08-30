import { config as envconfig } from "dotenv";
envconfig();

import config from "config";

import { BotConfig } from "./config/schema";
import("./bot/bot-instance");
import("./botApi");

process.env.TZ = (config.get("bot") as BotConfig).timezone;
