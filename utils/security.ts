import { promises as fs } from "fs";
import crypto from "crypto";

import NodeRSA from "node-rsa";

export async function encrypt(message: NodeRSA.Data): Promise<string> {
    const key = new NodeRSA(await fs.readFile("./config/sec/pub.key", "utf8"));

    return key.encrypt(message, "base64");
}

export async function decrypt(message: string | Buffer): Promise<string> {
    const key = new NodeRSA(await fs.readFile("./config/sec/priv.key", "utf8"));
    const decryptedKey = key.decrypt(message);

    return decryptedKey.toString("utf8");
}

export function generateRandomKey(size = 32): string {
    return crypto.randomBytes(size).toString("hex");
}

export function sha256(data: string) {
    return crypto.createHash("sha256").update(data).digest("hex");
}
