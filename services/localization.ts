import config from "config";
import { t, TOptions, use } from "i18next";
import Backend from "i18next-fs-backend";
import { join } from "path";

import { asyncMessageLocalStorage } from "../bot/core/HackerEmbassyBot";
import { BotConfig } from "../config/schema";

export const DEFAULT_LANGUAGE = "ru";
const botConfig = config.get<BotConfig>("bot");
const DEFAULT_LOCALES_PATH_PATTERN = "../resources/locales/{{lng}}/{{ns}}.yaml";

use(Backend).init({
    returnNull: false,
    backend: {
        loadPath: join(__dirname, botConfig.locales ?? DEFAULT_LOCALES_PATH_PATTERN),
    },
    supportedLngs: ["en", "ru"],
    preload: ["en", "ru"],
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
        escapeValue: false,
    },
    debug: false,
});

const translateWithDetectedLanguage = (key: string, options?: any): string => {
    const state = asyncMessageLocalStorage.getStore() as { language: string } | undefined;
    return t<string, TOptions, string>(key, { ...options, lng: state?.language } as TOptions);
};

export default translateWithDetectedLanguage;
