import "winston-daily-rotate-file";

import config from "config";
import { createLogger, format, transports } from "winston";

import { BotConfig } from "../config/schema";

const botConfig = config.get("bot") as BotConfig;

const rotatedFile = new transports.DailyRotateFile({
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
        format.printf(info => `${info.timestamp}: [${info.level}]\t${info.stack ?? info.message}\n`)
    ),
    transports: [rotatedFile, new transports.Console()],
});

export default logger;
