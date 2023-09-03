import config from "config";
import { Blob, default as fetch } from "node-fetch";

import { PrintersConfig } from "../config/schema";

const printersConfig = config.get("printers") as PrintersConfig;

export default class Printer3d {
    static async getPrinterStatus(printername: string) {
        const apiBase = this.getApiBase(printername);
        if (!apiBase) return null;

        const response = await fetch(`${apiBase}/printer/objects/query?print_stats&display_status&heater_bed&extruder`);
        return await response.json();
    }

    static async getFileMetadata(printername: string, filename: string) {
        const apiBase = this.getApiBase(printername);
        if (!apiBase || !filename) return null;

        const response = await fetch(`${apiBase}/server/files/metadata?filename=${filename}`);
        return await response.json();
    }

    static async getFile(printername: string, path: string): Promise<Blob | null> {
        const apiBase = this.getApiBase(printername);
        if (!apiBase || !path) return null;

        const response = await fetch(`${apiBase}/server/files/gcodes/${path}`);

        return response.status === 200 ? await response.blob() : null;
    }

    static async getCam(printername: string): Promise<Buffer | null> {
        const apiBase = this.getApiBase(printername);
        const camPort = this.getCamPort(printername);
        if (!apiBase) return null;

        const response = await fetch(`${apiBase}:${camPort}/snapshot`);
        const camblob = response.status === 200 ? await response.blob() : null;

        if (camblob)
            return await camblob
                // @ts-ignore
                .arrayBuffer()
                .then((arrayBuffer: WithImplicitCoercion<string> | { [Symbol.toPrimitive](hint: "string"): string }) =>
                    Buffer.from(arrayBuffer, "binary")
                );

        return null;
    }

    static async getThumbnail(printername: string, path: string): Promise<Buffer | null> {
        const apiBase = this.getApiBase(printername);
        if (!apiBase || !path) return null;

        const thumbnailBlob = await this.getFile(printername, path);

        if (!thumbnailBlob) return null;

        return await thumbnailBlob
            // @ts-ignore
            .arrayBuffer()
            .then((arrayBuffer: WithImplicitCoercion<string> | { [Symbol.toPrimitive](hint: "string"): string }) =>
                Buffer.from(arrayBuffer, "binary")
            );
    }

    static getApiBase(printername: string): string | null {
        switch (printername) {
            case "anette":
                return printersConfig.anette.apibase;
            case "plumbus":
                return printersConfig.plumbus.apibase;
            default:
                return null;
        }
    }

    static getCamPort(printername: string): number | null {
        switch (printername) {
            case "anette":
                return printersConfig.anette.camport;
            case "plumbus":
                return printersConfig.plumbus.camport;
            default:
                return null;
        }
    }
}
