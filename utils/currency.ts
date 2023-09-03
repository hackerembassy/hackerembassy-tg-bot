import config from "config";
import CryptoConvert from "crypto-convert";
import { Convert } from "easy-currencies";

import { CurrencyConfig } from "../config/schema";
import logger from "../services/logger";

const currencyConfig = config.get("currency") as CurrencyConfig;

type CurrencySymbol = "$" | "€" | "£" | "֏" | "₽";

const CurrencyFractionDigits = [
    { currency: "AMD", fraction: 0 },
    { currency: "RUB", fraction: 0 },
    { currency: "USD", fraction: 2 },
    { currency: "USDT", fraction: 2 },
    { currency: "USDC", fraction: 2 },
    { currency: "EUR", fraction: 2 },
    { currency: "BTC", fraction: 8 },
    { currency: "ETH", fraction: 6 },
];

const CurrencySymbolToCode = {
    ["$"]: "USD",
    ["€"]: "EUR",
    ["£"]: "GBP",
    ["֏"]: "AMD",
    ["₽"]: "RUB",
};

export function formatValueForCurrency(value: number, currency: string): number {
    const fraction = CurrencyFractionDigits.find(fd => fd.currency === currency)?.fraction ?? 4;
    return Number(value.toFixed(fraction));
}

export function parseMoneyValue(value: string) {
    return Number(value.replaceAll(/(k|тыс|тысяч|т)/g, "000").replaceAll(",", ""));
}

export async function prepareCurrency(currencyInput: string): Promise<string | null> {
    if (!currencyInput.length) return currencyConfig.default;

    if (Object.keys(CurrencySymbolToCode).includes(currencyInput)) return CurrencySymbolToCode[currencyInput as CurrencySymbol];

    const outputCurrency = currencyInput.toUpperCase();

    // We don't need nonconvertable currencies
    if (await convertCurrency(1, outputCurrency, "USD")) return outputCurrency;

    return null;
}

const convert = new CryptoConvert({
    cryptoInterval: currencyConfig.cryptoUpdateInterval,
    fiatInterval: currencyConfig.fiatUpdateInterval,
    calculateAverage: true,
    binance: true,
});

(async function () {
    await convert.ready(); //Wait for the initial cache to load
    await convert.addCurrency(
        "AMD",
        "USD",
        async () => await Convert(1).from("AMD").to("USD"),
        currencyConfig.fiatUpdateInterval
    );
})();

export async function convertCurrency(amount: number, from: string | number, to: string): Promise<number | undefined> {
    try {
        await convert.ready();

        return await convert[from as keyof typeof convert][to](amount);
    } catch (error) {
        logger.error("Error while converting currency", error);
        return undefined;
    }
}
