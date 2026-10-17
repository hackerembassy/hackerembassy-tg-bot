import "dotenv/config";

import config from "config";

import { StartTelegramBot } from "@hackembot/instance";
import { StartSpaceApi } from "@hackemapi/bot";
import { addDomainListeners } from "@services/listeners";

import { BotConfig } from "@config";

process.env.TZ = config.get<BotConfig>("bot").timezone;

addDomainListeners();
StartTelegramBot();
StartSpaceApi();
