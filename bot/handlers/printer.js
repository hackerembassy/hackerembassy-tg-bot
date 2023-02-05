const TextGenerators = require("../../services/textGenerators");
const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const fetch = require("node-fetch");
const BaseHandlers = require("./base");

class PrinterHandlers extends BaseHandlers {
  constructor() {
    super();
  }

  printerHandler = async (msg) => {
    let message = TextGenerators.getPrinterInfo();
    this.bot.sendMessage(msg.chat.id, message);
  };

  printerStatusHandler = async (msg) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      var { status, thumbnailBuffer } = await (
        await fetch(`${embassyApiConfig.host}:${embassyApiConfig.port}/printer`, { signal: controller.signal })
      )?.json();
      clearTimeout(timeoutId);

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
