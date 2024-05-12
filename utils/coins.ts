import { promises as fs } from "fs";
import path from "path";

export type CoinDefinition = {
    fullname: string;
    shortname: string;
    address: string;
    network: string;
    explorer: string;
    qrfile: string;
};

const QRBaseFolder = "../resources/coins/qr";

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

export function getCoinDefinition(coinname: string): CoinDefinition | undefined {
    return Coins.find(c => c.shortname === coinname);
}

export async function getQR(coinDef: CoinDefinition): Promise<Buffer> {
    return await fs.readFile(path.join(__dirname, QRBaseFolder, coinDef.qrfile));
}
