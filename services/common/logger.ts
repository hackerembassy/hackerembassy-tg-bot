import "winston-daily-rotate-file";
import fs from "node:fs";
import path from "node:path";

import config from "config";
import { createLogger, format, transports } from "winston";

import { LoggerConfig } from "@config";
import { lastModifiedFilePath, PROJECT_ROOT } from "@utils/filesystem";

const loggerConfig = config.get<LoggerConfig>("logger");
const datePattern = "YYYY-MM-DD";
const timePattern = "HH:mm:ss";
const fullPattern = `${datePattern} ${timePattern}`;
const logLevel = process.env["BOTDEBUG"] ? "debug" : loggerConfig.level;

const rotatedFile = new transports.DailyRotateFile({
    level: logLevel,
    filename: `${loggerConfig.logFolder}/%DATE%.log`,
    datePattern,
    zippedArchive: true,
    maxSize: loggerConfig.maxSize,
    maxFiles: loggerConfig.maxFiles,
});

const logger = createLogger({
    level: logLevel,
    format: format.combine(
        format.timestamp({
            format: fullPattern,
        }),
        format.errors({ stack: true }),
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        format.printf(info => `${info.timestamp}: [${info.level}]\t${info.stack ?? info.message}\n`)
    ),
    transports: [rotatedFile, new transports.Console()],
});

export function getLatestLogFilePath(): string | undefined {
    const logFolderPath = path.join(PROJECT_ROOT, loggerConfig.logFolder);
    const lastModifiedFile = lastModifiedFilePath(logFolderPath);
    const lastLogFilePath = lastModifiedFile ? path.join(PROJECT_ROOT, loggerConfig.logFolder, lastModifiedFile) : undefined;

    return lastLogFilePath && fs.existsSync(lastLogFilePath) ? lastLogFilePath : undefined;
}

export default logger;
