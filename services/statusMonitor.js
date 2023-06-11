var winston = require("winston");
const { format } = require("winston");
require("winston-daily-rotate-file");

const ping = require("ping");
const config = require("config");
const embassyServiceConfig = config.get("embassy-api");
const hosts = embassyServiceConfig.hostsToMonitor;

const transport = new winston.transports.DailyRotateFile({
    level: "info",
    filename: "log/application-%DATE%.log",
    datePattern: "YYYY-MM-DD-HH",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
});

/**
 * @type {string[]}
 */
const UnreadMessagesBuffer = [];

// TODO: Implement rotate
transport.on("rotate", function () {});

transport.on("logged", function (data) {
    UnreadMessagesBuffer.push(data);
});

const statusLogger = winston.createLogger({
    format: format.combine(
        format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
        }),
        format.json()
    ),
    transports: [transport],
});

async function pingInternalDevices() {
    for (let host of hosts) {
        let res = await ping.promise.probe(host);
        if (!res.alive) {
            statusLogger.error("Host " + host + " is not responding");
        }
    }
}

function startMonitoring() {
    console.log("Device monitoring started");
    setInterval(() => pingInternalDevices(), embassyServiceConfig.statusCheckInterval);
}

/**
 * @returns {string[]}
 */
function readNewMessages() {
    let unreadMessages = [];

    while (UnreadMessagesBuffer.length > 0) {
        unreadMessages.push(UnreadMessagesBuffer.shift());
    }

    return unreadMessages;
}

module.exports = { readNewMessages, startMonitoring };
