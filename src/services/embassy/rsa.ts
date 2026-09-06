import { promises as fs } from "node:fs";
import path from "node:path";

import NodeRSA from "node-rsa";

import { PROJECT_ROOT } from "@utils/filesystem";

// Holds the embassy door-unlock RSA keypair, loaded from disk once and reused - the keys never
// change at runtime, so re-reading and re-parsing the PEM files on every encrypt/decrypt call
// would be wasted I/O. The getters cache the load *promise*, not just the resolved key, so
// concurrent calls made before the first load finishes share one file read instead of racing.
class Rsa {
    public async encrypt(message: NodeRSA.Data): Promise<string> {
        const key = await this.pubKey;

        return key.encrypt(message, "base64");
    }

    public async decrypt(message: string | Buffer): Promise<string> {
        const key = await this.privKey;

        return key.decrypt(message).toString("utf8");
    }

    private static readonly pubPath = path.join(PROJECT_ROOT, "config/sec/pub.key");
    private static readonly privPath = path.join(PROJECT_ROOT, "config/sec/priv.key");

    private pub: Nullable<Promise<NodeRSA>> = null;
    private priv: Nullable<Promise<NodeRSA>> = null;

    private get pubKey(): Promise<NodeRSA> {
        return (this.pub ??= Rsa.load(Rsa.pubPath));
    }

    private get privKey(): Promise<NodeRSA> {
        return (this.priv ??= Rsa.load(Rsa.privPath));
    }

    private static async load(keyPath: string): Promise<NodeRSA> {
        return new NodeRSA(await fs.readFile(keyPath, "utf8"));
    }
}

export default new Rsa();
