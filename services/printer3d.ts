import config from "config";

import { PrinterEndpoint, PrintersConfig } from "@config";
import { fetchWithTimeout } from "@utils/network";

export type TemperatureStatus = {
    temperature: number;
    targer: number;
};

export type DisplayStatus = {
    progress: number;
};

export type PrintStatus = {
    state: string;
    filename: string;
    total_duration: number;
    filament_used: number;
};

export type PrinterStatus = {
    print_stats: PrintStatus;
    heater_bed: TemperatureStatus;
    extruder: TemperatureStatus;
    display_status: DisplayStatus;
    error?: string;
};

export type PrinterStatusResult = {
    status: PrinterStatus;
    thumbnailBuffer: Nullable<Buffer>;
    cam: Nullable<Buffer>;
};

export type FileMetadataResult = {
    thumbnails?: Thumbnail[];
    status: PrinterStatus;
    thumbnailBuffer: Nullable<Buffer>;
    cam: Nullable<Buffer>;
};

export type Thumbnail = {
    relative_path: string;
};

export type AvailablePrinter = keyof PrintersConfig;

const printersConfig = config.get<PrintersConfig>("printers");

export class Printer3d {
    private config: PrinterEndpoint;

    constructor(private name: keyof typeof printersConfig) {
        this.config = printersConfig[this.name];
    }

    async getPrinterStatus() {
        const response = await fetchWithTimeout(
            `${this.config.apibase}/printer/objects/query?print_stats&display_status&heater_bed&extruder`
        );
        const responseBody = (await response.json()) as { result: PrinterStatusResult };

        return responseBody.result;
    }

    async getFileMetadata(filename: string) {
        const response = await fetchWithTimeout(`${this.config.apibase}/server/files/metadata?filename=${filename}`);
        const responseBody = (await response.json()) as { result?: FileMetadataResult };

        return responseBody.result;
    }

    async getFile(path: string): Promise<Nullable<Blob>> {
        const response = await fetchWithTimeout(`${this.config.apibase}/server/files/gcodes/${path}`);

        return response.status === 200 ? await response.blob() : null;
    }

    async getCam(): Promise<Nullable<Buffer>> {
        const response = await fetchWithTimeout(`${this.config.apibase}:${this.config.camport}/snapshot`);
        const camblob = response.status === 200 ? await response.blob() : null;

        if (camblob) return await camblob.arrayBuffer().then(arrayBuffer => Buffer.from(arrayBuffer));

        return null;
    }

    async getThumbnail(path: string): Promise<Nullable<Buffer>> {
        if (!path) return null;

        const thumbnailBlob = await this.getFile(path);

        if (!thumbnailBlob) return null;

        return await thumbnailBlob.arrayBuffer().then(arrayBuffer => Buffer.from(arrayBuffer));
    }
}

export const AvailablePrinters = new Map<string, Printer3d>(
    (Object.keys(printersConfig) as AvailablePrinter[]).map(key => [key, new Printer3d(key)])
);
