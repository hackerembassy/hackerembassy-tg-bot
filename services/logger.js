const { createLogger, format, transports } = require("winston");
const config = require("config");
const botConfig = config.get("bot");

const logger = createLogger({
    level: "info",
    format: format.combine(
        format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    transports: [new transports.File({ filename: botConfig.logpath }), new transports.Console({ format: format.simple() })],
});

module.exports = logger;
