import "dotenv/config";

import config from "config";

import { BotConfig } from "@config";

import { StartEmbassyApi } from "./api/embassy";

process.env.TZ = config.get<BotConfig>("bot").timezone;

StartEmbassyApi();
