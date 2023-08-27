import { promises as fs } from "fs";
import NodeRSA from "node-rsa";

/**
 * @param {NodeRSA.Data} message
 */
export async function encrypt(message: NodeRSA.Data) {
    const key = new NodeRSA(await fs.readFile("./config/sec/pub.key", "utf8"));

    return key.encrypt(message, "base64");
}

/**
 * @param {string | Buffer} message
 */
export async function decrypt(message: string | Buffer) {
    const key = new NodeRSA(await fs.readFile("./config/sec/priv.key", "utf8"));
    const decryptedKey = key.decrypt(message);

    return decryptedKey.toString("utf8");
}
