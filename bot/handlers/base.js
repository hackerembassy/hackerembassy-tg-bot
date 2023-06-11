const botlib = require("../bot");
const config = require("config");
const botConfig = config.get("bot");

class BaseHandlers {
    constructor() {
        this.bot = botlib;
        this.botConfig = botConfig;
    }
}

module.exports = BaseHandlers;
