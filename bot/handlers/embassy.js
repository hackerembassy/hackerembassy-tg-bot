const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const fetch = require("node-fetch");
const BaseHandlers = require("./base");

class PrinterHandlers extends BaseHandlers {
  controller = new AbortController();
  timeoutId = setTimeout(() => this.controller.abort(), 15000);

  constructor() {
    super();
  }

  webcamHandler = async (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;

    try {
      let response = await (
        await fetch(`${embassyApiConfig.host}:${embassyApiConfig.port}/webcam`, { signal: this.controller.signal })
      )?.arrayBuffer()
      clearTimeout(this.timeoutId);

      let webcamImage = Buffer.from(response);

      if (webcamImage) this.bot.sendPhoto(msg.chat.id, webcamImage)
      else throw Error();
    } catch {
      let message = `⚠️ Камера пока недоступна`;
      this.bot.sendMessage(msg.chat.id, message);
    }
  };

  printerHandler = async (msg) => {
    let message = TextGenerators.getPrinterInfo();
    this.bot.sendMessage(msg.chat.id, message);
  };

  printerStatusHandler = async (msg) => {
    try {
      var { status, thumbnailBuffer } = await (
        await fetch(`${embassyApiConfig.host}:${embassyApiConfig.port}/printer`, { signal: this.controller.signal })
      )?.json();
      clearTimeout(this.timeoutId);

      if (status && !status.error) var message = await TextGenerators.getPrinterStatus(status);
      else throw Error();
    } catch {
      message = `⚠️ Принтер пока недоступен`;
    } finally {
      if (thumbnailBuffer) this.bot.sendPhoto(msg.chat.id, Buffer.from(thumbnailBuffer), { caption: message });
      else this.bot.sendMessage(msg.chat.id, message);
    }
  };
}

module.exports = PrinterHandlers;
