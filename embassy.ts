import { config as envconfig } from "dotenv";
envconfig();

import config from "config";

import { StartEmbassyApi } from "./api/embassy";
import { BotConfig } from "./config/schema";

process.env.TZ = config.get<BotConfig>("bot").timezone;

StartEmbassyApi();
