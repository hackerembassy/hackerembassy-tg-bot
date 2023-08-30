import "winston-daily-rotate-file";

import config from "config";
import { promise } from "ping";
import Winston from "winston";

import { BotConfig, EmbassyApiConfig } from "../config/schema";

const botConfig = config.get("bot") as BotConfig;
const embassyServiceConfig = config.get("embassy-api") as EmbassyApiConfig;
const hosts = embassyServiceConfig.hostsToMonitor;

const transport = new Winston.transports.DailyRotateFile({
    level: "info",
    filename: `${botConfig.logfolderpath}/monitor/%DATE%.log`,
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
});

const UnreadMessagesBuffer: string[] = [];

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

async function pingInternalDevices() {
    for (const host of hosts) {
        const res = await promise.probe(host);
        if (!res.alive) {
            statusLogger.error("Host " + host + " is not responding");
        }
    }
}

export function startMonitoring() {
    console.log("Device monitoring started");
    setInterval(() => pingInternalDevices(), embassyServiceConfig.statusCheckInterval);
}

export function readNewMessages(): string[] {
    const unreadMessages = [];

    while (UnreadMessagesBuffer.length > 0) {
        unreadMessages.push(UnreadMessagesBuffer.shift());
    }

    return unreadMessages;
}
