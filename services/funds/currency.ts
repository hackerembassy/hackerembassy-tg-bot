/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { promises as fs } from "fs";
import path from "path";

import config from "config";
import CryptoConvert from "crypto-convert";
import { Convert } from "easy-currencies";

import { CurrencyConfig } from "@config";

import logger from "../common/logger";

export type CoinDefinition = {
    fullname: string;
    shortname: string;
    address: string;
    network: string;
    explorer: string;
    qrfile: string;
};

export const Coins: CoinDefinition[] = [
    {
        fullname: "Bitcoin",
        shortname: "btc",
        address: "bc1q8d4y2hza9yeevjp7fyvndd6tc6pmt8k9jk70vf",
        network: "BTC",
        qrfile: "btc.jpg",
        explorer: "https://memepool.space",
    },
    {
        fullname: "Ethereum",
        shortname: "eth",
        address: "0x3Fd7976eeC03b07e28BDC8BeaD6e279CeF04170b",
        network: "ETH",
        qrfile: "eth.jpg",
        explorer: "https://etherscan.io",
    },
    {
        fullname: "USD Coin",
        shortname: "usdc",
        address: "0x3Fd7976eeC03b07e28BDC8BeaD6e279CeF04170b",
        network: "ERC20",
        qrfile: "usdc.jpg",
        explorer: "https://etherscan.io",
    },
    {
        fullname: "Tether",
        shortname: "usdt",
        address: "0x3Fd7976eeC03b07e28BDC8BeaD6e279CeF04170b",
        network: "BEP20",
        qrfile: "usdt.jpg",
        explorer: "https://bscscan.com",
    },
    {
        fullname: "Tron",
        shortname: "trx",
        address: "TEfXwMLXyTuhAhwNCvJm7acxtW3zHvabhu",
        network: "TRX",
        qrfile: "trx.jpg",
        explorer: "https://tronscan.io/",
    },
    {
        fullname: "Ton",
        shortname: "ton",
        address: "EQDWp5mlGr9oNR_LGxvT1N4MEIqboRuCE35SZI2NTsH8QeO1",
        network: "TON",
        qrfile: "ton.jpg",
        explorer: "https://tonscan.com/",
    },
];

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

const currencyConfig = config.get<CurrencyConfig>("currency");
const QRBaseFolder = "../../resources/coins/qr";

export const DefaultCurrency = currencyConfig.default;

export function formatValueForCurrency(value: number, currency: string): number {
    const fraction = CurrencyFractionDigits.find(fd => fd.currency === currency)?.fraction ?? 4;
    return Number(value.toFixed(fraction));
}

export function parseMoneyValue(value: string) {
    return Number(value.replaceAll(/(k|тыс|тысяч|т)/g, "000").replaceAll(",", ""));
}

export function toBasicMoneyString(value: number): string {
    return new Intl.NumberFormat("en", {
        style: "decimal",
        trailingZeroDisplay: "stripIfInteger",
        minimumFractionDigits: 2,
        useGrouping: false,
    }).format(value);
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
    to: string = DefaultCurrency
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

export async function sumDonations(
    fundDonations: { value: number; currency: string }[],
    targetCurrency: string = DefaultCurrency
) {
    return await fundDonations.reduce(async (prev, current) => {
        const newValue = await convertCurrency(current.value, current.currency, targetCurrency);
        const prevValue = await prev;

        return newValue ? prevValue + newValue : prevValue;
    }, Promise.resolve(0));
}

export function getCoinDefinition(coinname: string): CoinDefinition | undefined {
    return Coins.find(c => c.shortname === coinname);
}

export async function getCoinQR(coinDef: CoinDefinition): Promise<Buffer> {
    return await fs.readFile(path.join(__dirname, QRBaseFolder, coinDef.qrfile));
}
