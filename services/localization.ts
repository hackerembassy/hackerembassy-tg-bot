import config from "config";
import { t, TFunction, use } from "i18next";
import Backend from "i18next-fs-backend";
import { join } from "path";

import { BotConfig } from "../config/schema";

const botConfig = config.get<BotConfig>("bot");
const DEFAULT_LOCALES_PATH_PATTERN = "../resources/locales/{{lng}}/{{ns}}.yaml";

// @ts-ignore
use(Backend).init({
    returnNull: false,
    backend: {
        loadPath: join(__dirname, botConfig.locales ?? DEFAULT_LOCALES_PATH_PATTERN),
    },
    interpolation: {
        escapeValue: false,
    },
    lng: "ru",
    debug: false,
});

export default t as TFunction;
