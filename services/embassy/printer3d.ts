import config from "config";

import { PrinterEndpoint, PrintersConfig } from "@config";
import { fetchWithTimeout } from "@utils/network";

// Types
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

// Config
const printersConfig = config.get<PrintersConfig>("printers");

// Classes
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

    async getFile(path: string): Promise<Nullable<Buffer>> {
        const response = await fetchWithTimeout(`${this.config.apibase}/server/files/gcodes/${path}`);

        return response.ok ? response.buffer() : null;
    }

    async getCam(): Promise<Nullable<Buffer>> {
        const response = await fetchWithTimeout(`${this.config.apibase}:${this.config.camport}/snapshot`);

        return response.ok ? response.buffer() : null;
    }

    async getThumbnail(path: string): Promise<Nullable<Buffer>> {
        return path ? await this.getFile(path) : null;
    }
}

export const AvailablePrinters = new Map<string, Printer3d>(
    (Object.keys(printersConfig) as AvailablePrinter[]).map(key => [key, new Printer3d(key)])
);
