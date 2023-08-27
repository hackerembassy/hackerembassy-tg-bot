import { transports as _transports, createLogger, format as _format } from "winston";
import "winston-daily-rotate-file";

import { promise } from "ping";
import config from "config";
const botConfig = config.get("bot") as any;

const embassyServiceConfig = config.get("embassy-api") as any;
const hosts = embassyServiceConfig.hostsToMonitor;

const transport = new _transports.DailyRotateFile({
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

const statusLogger = createLogger({
    format: _format.combine(
        _format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
        }),
        _format.json()
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

/**
 * @returns {string[]}
 */
export function readNewMessages(): string[] {
    const unreadMessages = [];

    while (UnreadMessagesBuffer.length > 0) {
        unreadMessages.push(UnreadMessagesBuffer.shift());
    }

    return unreadMessages;
}
