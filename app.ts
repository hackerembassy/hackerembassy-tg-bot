import { config as envconfig } from "dotenv";
envconfig();

import config from "config";

import { BotConfig } from "./config/schema";
import("./bot/init/instance");
import("./botApi");

process.env.TZ = config.get<BotConfig>("bot").timezone;
