import { config as envconfig } from "dotenv";
envconfig();

import config from "config";

import { BotConfig } from "./config/schema";
import("./bot/init/instance");
import("./api/bot");

process.env.TZ = config.get<BotConfig>("bot").timezone;
