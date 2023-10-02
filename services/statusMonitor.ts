import "winston-daily-rotate-file";

import config from "config";
import { promise } from "ping";
import Winston from "winston";

import { BotConfig, EmbassyApiConfig } from "../config/schema";
import logger from "./logger";

const botConfig = config.get<BotConfig>("bot");
const embassyServiceConfig = config.get<EmbassyApiConfig>("embassy-api");
const hosts = embassyServiceConfig.hostsToMonitor;

export type MonitorMessage = {
    level: string;
    message: string;
    timestamp: string;
};

const transport = new Winston.transports.DailyRotateFile({
    level: "info",
    filename: `${botConfig.logfolderpath}/monitor/%DATE%.log`,
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
});

const UnreadMessagesBuffer: MonitorMessage[] = [];

transport.on("logged", function (data) {
    UnreadMessagesBuffer.push(data);
});

const statusLogger = Winston.createLogger({
    format: Winston.format.combine(
        Winston.format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
        }),
        Winston.format.json()
    ),
    transports: [transport],
});

async function pingInternalDevices(): Promise<void> {
    if (!hosts) return;

    for (const host of hosts) {
        const res = await promise.probe(host);
        if (!res.alive) {
            statusLogger.error("Host " + host + " is not responding");
        }
    }
}

export function startMonitoring(): void {
    logger.info("Device monitoring started");
    setInterval(() => pingInternalDevices(), embassyServiceConfig.statusCheckInterval);
}

export function readNewMessages(): MonitorMessage[] {
    const unreadMessages = [];

    while (UnreadMessagesBuffer.length > 0) {
        unreadMessages.push(UnreadMessagesBuffer.shift());
    }

    return unreadMessages as MonitorMessage[];
}
