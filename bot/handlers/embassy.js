const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const fetch = require("node-fetch");
const BaseHandlers = require("./base");
const logger = require("../../services/logger");
const usersRepository = require("../../repositories/usersRepository");
const { json } = require("body-parser");

class PrinterHandlers extends BaseHandlers {
  controller = new AbortController();
  timeoutId = setTimeout(() => this.controller.abort(), 15000);

  constructor() {
    super();
  }

  unlockHandler = async (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;
    try {
      let devices = await (await fetch(`${embassyApiConfig.host}:${embassyApiConfig.port}/devices`, { signal: this.controller.signal }))?.json();
      clearTimeout(this.timeoutId);

      let currentUser = usersRepository.getUser(msg.from.username);
      if (!devices.includes(currentUser.mac)){
        this.bot.sendMessage(msg.chat.id, "Ваш MAC адрес не обнаружен роутером. Вы должны быть рядом со спейсом, чтобы его открыть");
        return;
      }

      let key = { unlockkey: process.env["UNLOCKKEY"]};

      let response = await (
        await fetch(`${embassyApiConfig.host}:${embassyApiConfig.port}/unlock`, { headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }, signal: this.controller.signal, method:"post", body:JSON.stringify(key)})
      );
      clearTimeout(this.timeoutId);
      if (response.status === 200) await this.bot.sendMessage(msg.chat.id, "Дверь открыта");
      else throw Error("Не вышло открыть");
    } catch(error) {
      logger.error(error);
      let message = `⚠️ Сервис недоступен`;
      this.bot.sendMessage(msg.chat.id, message);
    } finally {
      clearTimeout(this.timeoutId);
    }
  }

  webcamHandler = async (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;

    try {
      let response = await (
        await fetch(`${embassyApiConfig.host}:${embassyApiConfig.port}/webcam`, { signal: this.controller.signal })
      )?.arrayBuffer()
      clearTimeout(this.timeoutId);

      let webcamImage = Buffer.from(response);

      if (webcamImage) await this.bot.sendPhoto(msg.chat.id, webcamImage)
      else throw Error("Empty webcam image");
    } catch(error) {
      logger.error(error);
      let message = `⚠️ Камера пока недоступна`;
      this.bot.sendMessage(msg.chat.id, message);
    } finally {
      clearTimeout(this.timeoutId);
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
    } catch (error) {
      logger.error(error);
      message = `⚠️ Принтер пока недоступен`;
    } finally {
      clearTimeout(this.timeoutId);
      if (thumbnailBuffer) this.bot.sendPhoto(msg.chat.id, Buffer.from(thumbnailBuffer), { caption: message });
      else this.bot.sendMessage(msg.chat.id, message);
    }
  };
}

module.exports = PrinterHandlers;
