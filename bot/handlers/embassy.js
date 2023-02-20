const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const config = require("config");
const fs = require("fs").promises;
const embassyApiConfig = config.get("embassy-api");
const fetch = require("node-fetch");
const BaseHandlers = require("./base");
const logger = require("../../services/logger");
const usersRepository = require("../../repositories/usersRepository");
const NodeRSA = require('node-rsa');

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
        this.bot.sendMessage(msg.chat.id, "❌ Твой MAC адрес не обнаружен роутером. Надо быть рядом со спейсом, чтобы его открыть");
        return;
      }

      let key = new NodeRSA(await fs.readFile("./sec/pub.key", 'utf8'));
      let encryptedKey = key.encrypt(process.env["UNLOCKKEY"], "base64");

      let response = await (
        await fetch(`${embassyApiConfig.host}:${embassyApiConfig.port}/unlock`, { headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }, signal: this.controller.signal, method:"post", body: JSON.stringify({ token:encryptedKey, from:msg.from.username })})
      );
      clearTimeout(this.timeoutId);
      
      if (response.status === 200){
        logger.info(`${msg.from.username} открыл дверь`);
        await this.bot.sendMessage(msg.chat.id, "🔑 Дверь открыта");
      } 
      else throw Error("Request error");
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
