const { createLogger, format, transports } = require("winston");
const winston = require("winston");
require("winston-daily-rotate-file");
const botConfig = require("config").get("bot");

const rotatedFile = new winston.transports.DailyRotateFile({
    level: "info",
    filename: `${botConfig.logfolderpath}/%DATE%.log`,
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
});

const logger = createLogger({
    level: "info",
    format: format.combine(
        format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
        }),
        format.errors({ stack: true }),
        format.printf(info => `${info.timestamp}: [${info.level.toUpperCase()}]\t${info.stack ?? info.message}\n`)
    ),
    transports: [rotatedFile, new transports.Console()],
});

module.exports = logger;
