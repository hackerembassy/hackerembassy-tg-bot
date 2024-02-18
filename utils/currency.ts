/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import config from "config";
import CryptoConvert from "crypto-convert";
import { Convert } from "easy-currencies";

import { CurrencyConfig } from "../config/schema";
import logger from "../services/logger";

const currencyConfig = config.get<CurrencyConfig>("currency");

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

const MediatorCurrency = "USD";

export function formatValueForCurrency(value: number, currency: string): number {
    const fraction = CurrencyFractionDigits.find(fd => fd.currency === currency)?.fraction ?? 4;
    return Number(value.toFixed(fraction));
}

export function parseMoneyValue(value: string) {
    return Number(value.replaceAll(/(k|тыс|тысяч|т)/g, "000").replaceAll(",", ""));
}

export async function prepareCurrency(currencyInput: string): Promise<Nullable<string>> {
    if (!currencyInput.length) return currencyConfig.default;

    if (Object.keys(CurrencySymbolToCode).includes(currencyInput)) return CurrencySymbolToCode[currencyInput as CurrencySymbol];

    const outputCurrency = currencyInput.toUpperCase();

    // We don't need nonconvertable currencies
    if (await convertCurrency(1, outputCurrency, "USD")) return outputCurrency;

    return null;
}

// Convert Singleton
let convert: Nullable<CryptoConvert> = null;

export async function initConvert() {
    convert = new CryptoConvert({
        cryptoInterval: currencyConfig.cryptoUpdateInterval,
        fiatInterval: currencyConfig.fiatUpdateInterval,
        calculateAverage: true,
        binance: true,
    });
    await convert.ready(); //Wait for the initial cache to load
    await convert.addCurrency(
        "AMD",
        "USD",
        async () => await Convert(1).from("AMD").to("USD"),
        currencyConfig.fiatUpdateInterval
    );
    await convert.addCurrency(
        "BYN",
        "USD",
        async () => await Convert(1).from("BYN").to("USD"),
        currencyConfig.fiatUpdateInterval
    );
    await convert.addCurrency(
        "GEL",
        "USD",
        async () => await Convert(1).from("GEL").to("USD"),
        currencyConfig.fiatUpdateInterval
    );
}

export async function convertCurrency(
    amount: number,
    from: string | number,
    to: string = currencyConfig.default
): Promise<Optional<number>> {
    try {
        if (from === to) return amount;

        if (!convert) await initConvert();

        if (convert) {
            await convert.ready();

            let result = (await convert[from as keyof typeof convert][to](amount)) as number | null;

            // If direct conversion failed, try to convert to mediator currency first
            if (!result) {
                const toMediatorCurrency = (await convert[from as keyof typeof convert][MediatorCurrency](amount)) as number;
                result = (await convert[MediatorCurrency as keyof typeof convert][to](toMediatorCurrency)) as number | null;
            }

            return result;
        } else {
            throw new Error("Error while converting currency, convert failed to initialise");
        }
    } catch (error) {
        logger.error("Error while converting currency", error);
        return undefined;
    }
}

export async function sumDonations(fundDonations: { value: number; currency: string }[], targetCurrency: string = "AMD") {
    return await fundDonations.reduce(async (prev, current) => {
        const newValue = await convertCurrency(current.value, current.currency, targetCurrency);
        const prevValue = await prev;

        return newValue ? prevValue + newValue : prevValue;
    }, Promise.resolve(0));
}
