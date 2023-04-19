const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const { fetchWithTimeout } = require("../../utils/network");
const BaseHandlers = require("./base");
const logger = require("../../services/logger");
const usersRepository = require("../../repositories/usersRepository");
const { encrypt } = require("../../utils/security");

class PrinterHandlers extends BaseHandlers {
  constructor() {
    super();
  }

  unlockHandler = async (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;
    try {
      let devices = await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/${embassyApiConfig.devicesCheckingPath}`))?.json();

      let currentUser = usersRepository.getUser(msg.from.username);
      if (!devices.includes(currentUser.mac)) {
        this.bot.sendMessage(
          msg.chat.id,
          "❌ Твой MAC адрес не обнаружен роутером. Надо быть рядом со спейсом, чтобы его открыть"
        );
        return;
      }

      let token = await encrypt(process.env["UNLOCKKEY"]);

      let response = await await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/unlock`, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "post",
        body: JSON.stringify({ token, from: msg.from.username }),
      });

      if (response.status === 200) {
        logger.info(`${msg.from.username} открыл дверь`);
        await this.bot.sendMessage(msg.chat.id, "🔑 Дверь открыта");
      } else throw Error("Request error");

    } catch (error) {
      let message = `⚠️ Сервис недоступен`;
      this.bot.sendMessage(msg.chat.id, message);
      logger.error(error);
    }
  };

  webcamHandler = async (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;

    try {
      let response = await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/webcam`))?.arrayBuffer();

      let webcamImage = Buffer.from(response);

      if (webcamImage) await this.bot.sendPhoto(msg.chat.id, webcamImage);
      else throw Error("Empty webcam image");
    } catch (error) {
      let message = `⚠️ Камера пока недоступна`;
      this.bot.sendMessage(msg.chat.id, message);
      logger.error(error);
    }
  };

  sendDoorcam = async (chatid) => {
    try {
      let response = await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/doorcam`))?.arrayBuffer();
  
      let webcamImage = Buffer.from(response);
  
      if (webcamImage) await this.bot.sendPhoto(chatid, webcamImage);
      else throw Error("Empty doorcam image");
    } catch (error) {
      let message = `⚠️ Камера пока недоступна`;
      this.bot.sendMessage(chatid, message);
      logger.error(error);
    }
  }

  doorcamHandler = async (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;

    await this.sendDoorcam(msg.chat.id);
  };

  printerHandler = async (msg) => {
    let message = TextGenerators.getPrinterInfo();
    let inlineKeyboard = [
      [
        {
          text: "Статус Anette",
          callback_data: JSON.stringify({ command: "/printerstatus" }),
        },
      ],
    ]

    this.bot.sendMessage(msg.chat.id, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  };

  printerStatusHandler = async (msg) => {
    try {
      var { status, thumbnailBuffer, cam } = await (
        await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/printer`)
      )?.json();

      if (status && !status.error) var message = await TextGenerators.getPrinterStatus(status);
      else throw Error();
    } catch (error) {
      logger.error(error);
      message = `⚠️ Принтер пока недоступен`;
    } finally {
      if (cam) await this.bot.sendPhoto(msg.chat.id, Buffer.from(cam));

      let inlineKeyboard = [
        [
          {
            text: "Обновить статус Anette",
            callback_data: JSON.stringify({ command: "/printerstatus" }),
          },
        ],
      ]

      if (thumbnailBuffer) await this.bot.sendPhoto(msg.chat.id, Buffer.from(thumbnailBuffer), { caption: message, reply_markup: {
        inline_keyboard: inlineKeyboard,
      } });
      else await this.bot.sendMessage(msg.chat.id, message, {reply_markup: {
        inline_keyboard: inlineKeyboard,
      }});
    }
  };

  doorbellHandler = async (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;

    try {
      let status = await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/doorbell`))?.json();

      if (status && !status.error) var message = "🔔 Звоним в дверной звонок";
      else throw Error();
    } catch (error) {
      message = `🔕 Не вышло позвонить`;
      logger.error(error);
    } finally {
      this.bot.sendMessage(msg.chat.id, message);
    }
  };
}

module.exports = PrinterHandlers;
