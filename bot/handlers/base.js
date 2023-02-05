const botlib = require("../bot");
const { tag } = require("../botExtensions");
const config = require("config");
const botConfig = config.get("bot");

class BaseHandlers {
  constructor(){
    this.bot = botlib;
    this.botConfig = botConfig;
    this.tag = tag;
  }
}

module.exports = BaseHandlers;
