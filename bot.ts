import "dotenv/config";

import config from "config";

import { StartSpaceApi } from "./api/bot";
import { StartTelegramBot } from "./bot/instance";
import { BotConfig } from "./config/schema";

process.env.TZ = config.get<BotConfig>("bot").timezone;

StartTelegramBot();
StartSpaceApi();
