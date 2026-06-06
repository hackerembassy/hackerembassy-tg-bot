import "dotenv/config";

import config from "config";

import { StartTelegramBot } from "@hackembot/instance";
import { StartSpaceApi } from "@hackemapi/bot";

import { BotConfig } from "@config";

process.env.TZ = config.get<BotConfig>("bot").timezone;

StartTelegramBot();
StartSpaceApi();
