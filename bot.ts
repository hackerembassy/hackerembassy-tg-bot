import "dotenv/config";

import config from "config";

import { BotConfig } from "@config";

import { StartSpaceApi } from "./api/bot";
import { StartTelegramBot } from "./bot/instance";

process.env.TZ = config.get<BotConfig>("bot").timezone;

StartTelegramBot();
StartSpaceApi();
