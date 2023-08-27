import config from "config";
import { default as fetch } from "node-fetch";
const printersConfig = config.get("printers") as any;

export default class Printer3d {
    /**
     * @param {string} printername
     */
    static async getPrinterStatus(printername: string) {
        const apiBase = this.getApiBase(printername);
        if (!apiBase) return null;

        const response = await fetch(`${apiBase}/printer/objects/query?print_stats&display_status&heater_bed&extruder`);
        return await response.json();
    }

    /**
     * @param {string} printername
     * @param {string} filename
     */
    static async getFileMetadata(printername: string, filename: string) {
        const apiBase = this.getApiBase(printername);
        if (!apiBase || !filename) return null;

        const response = await fetch(`${apiBase}/server/files/metadata?filename=${filename}`);
        return await response.json();
    }

    /**
     * @param {string} printername
     * @param {string} path
     */
    static async getFile(printername: string, path: string) {
        const apiBase = this.getApiBase(printername);
        if (!apiBase || !path) return null;

        const response = await fetch(`${apiBase}/server/files/gcodes/${path}`);
        return response.status === 200 ? await response.blob() : null;
    }

    /**
     * @param {string} printername
     */
    static async getCam(printername: string) {
        const apiBase = this.getApiBase(printername);
        const camPort = this.getCamPort(printername);
        if (!apiBase) return null;

        const response = await fetch(`${apiBase}:${camPort}/snapshot`);
        const camblob = response.status === 200 ? await response.blob() : null;

        if (camblob)
            return await camblob
                // @ts-ignore
                .arrayBuffer()
                .then(
                    (
                        /** @type {WithImplicitCoercion<string> | { [Symbol.toPrimitive](hint: "string"): string; }} */ arrayBuffer:
                            | WithImplicitCoercion<string>
                            | { [Symbol.toPrimitive](hint: "string"): string }
                    ) => Buffer.from(arrayBuffer, "binary")
                );

        return null;
    }

    /**
     * @param {string} printername
     * @param {string} path
     */
    static async getThumbnail(printername: string, path: string) {
        const apiBase = this.getApiBase(printername);
        if (!apiBase || !path) return null;

        const thumbnailBlob = await this.getFile(printername, path);

        if (!thumbnailBlob) return null;

        return await thumbnailBlob
            // @ts-ignore
            .arrayBuffer()
            .then(
                (
                    /** @type {WithImplicitCoercion<string> | { [Symbol.toPrimitive](hint: "string"): string; }} */ arrayBuffer:
                        | WithImplicitCoercion<string>
                        | { [Symbol.toPrimitive](hint: "string"): string }
                ) => Buffer.from(arrayBuffer, "binary")
            );
    }

    /**
     * @param {string} printername
     */
    static getApiBase(printername: string) {
        switch (printername) {
            case "anette":
                return printersConfig.anette.apibase;
            case "plumbus":
                return printersConfig.plumbus.apibase;
            default:
                return null;
        }
    }

    /**
     * @param {string} printername
     */
    static getCamPort(printername: string) {
        switch (printername) {
            case "anette":
                return printersConfig.anette.camPort;
            case "plumbus":
                return printersConfig.plumbus.camPort;
            default:
                return null;
        }
    }
}
