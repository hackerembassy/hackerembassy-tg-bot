import { t, TOptions, use } from "i18next";
import Backend from "i18next-fs-backend";
import { join } from "path";

import bot from "../instance";

// Supported languages
export const DEFAULT_LANGUAGE = "ru";
export const SUPPORTED_LANGUAGES = ["en", "ru"] as const;

// Type for supported languages
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(value: any): value is SupportedLanguage {
    return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

const DEFAULT_LOCALES_PATH_PATTERN = "{{lng}}/{{ns}}.yaml";
const RESOURCES_PATH = "../../resources/locales/";

use(Backend).init({
    returnNull: false,
    backend: {
        loadPath: join(__dirname, RESOURCES_PATH, DEFAULT_LOCALES_PATH_PATTERN),
    },
    supportedLngs: SUPPORTED_LANGUAGES,
    preload: SUPPORTED_LANGUAGES,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
        escapeValue: false,
    },
    debug: false,
});

const translateWithDetectedLanguage = (key: string, options?: any, lang?: string): string => {
    const state = bot.asyncContext.getStore() as { language: string } | undefined;
    return t<string, TOptions, string>(key, { ...options, lng: lang ?? state?.language } as TOptions);
};

export default translateWithDetectedLanguage;
