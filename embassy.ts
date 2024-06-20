import "dotenv/config";

import config from "config";

import { StartEmbassyApi } from "@hackemapi/embassy";

import { BotConfig } from "@config";

process.env.TZ = config.get<BotConfig>("bot").timezone;

StartEmbassyApi();
