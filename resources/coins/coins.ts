import { promises as fs } from "fs";
import path from "path";

export const Coins = [
    {
        fullname: "Bitcoin",
        shortname: "btc",
        address: "bc1q8d4y2hza9yeevjp7fyvndd6tc6pmt8k9jk70vf",
        network: "BTC",
        qrfile: "btc.jpg",
    },
    {
        fullname: "Ethereum",
        shortname: "eth",
        address: "0x3Fd7976eeC03b07e28BDC8BeaD6e279CeF04170b",
        network: "ETH",
        qrfile: "eth.jpg",
    },
    {
        fullname: "USD Coin",
        shortname: "usdc",
        address: "0x3Fd7976eeC03b07e28BDC8BeaD6e279CeF04170b",
        network: "ERC20",
        qrfile: "usdc.jpg",
    },
    {
        fullname: "Tether",
        shortname: "usdt",
        address: "0x3Fd7976eeC03b07e28BDC8BeaD6e279CeF04170b",
        network: "BEP20",
        qrfile: "usdt.jpg",
    },
];

const QRBaseFolder = "./qr";

export function getCoinDefinition(coinname: string) {
    return Coins.find(c => c.shortname === coinname);
}

export async function getQR(coinname: string) {
    const buffer = await fs.readFile(path.join(__dirname, QRBaseFolder, getCoinDefinition(coinname).qrfile));

    return buffer;
}
