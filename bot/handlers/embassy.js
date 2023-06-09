const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const botConfig = config.get("bot");
const { fetchWithTimeout } = require("../../utils/network");
const BaseHandlers = require("./base");
const logger = require("../../services/logger");
const usersRepository = require("../../repositories/usersRepository");
const { encrypt } = require("../../utils/security");
const { isMacInside } = require("../../services/statusHelper");

class EmbassyHanlers extends BaseHandlers {
  constructor() {
    super();
  }

  unlockHandler = async (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;

    try {
      let devices = await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/${embassyApiConfig.devicesCheckingPath}`))?.json();

      let currentUser = usersRepository.getUser(msg.from.username);

      if(!isMacInside(currentUser.mac, devices)){
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
    await this.webcamGenericHandler(msg, "webcam", "Первый этаж")
  };

  webcam2Handler = async (msg) => {
    await this.webcamGenericHandler(msg, "webcam2", "Второй этаж")
  };

  doorcamHandler = async (msg) => {
    await this.webcamGenericHandler(msg, "doorcam", "Входная дверь")
  };

  webcamGenericHandler = async (msg, path, prefix) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;

    try {
      let response = await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/${path}`))?.arrayBuffer();

      let webcamImage = Buffer.from(response);

      if (webcamImage) await this.bot.sendPhoto(msg.chat.id, webcamImage);
      else throw Error("Empty webcam image");
    } catch (error) {
      let message = `⚠️ ${prefix}: Камера пока недоступна`;
      await this.bot.sendMessage(msg.chat.id, message);
      logger.error(error);
    }
  };

  monitorHandler = async (msg, notifyEmpty = false) => {
    try {
      let statusMessages = await this.queryStatusMonitor();

      if (!notifyEmpty && statusMessages.length === 0) return;

      let message = statusMessages.length > 0 ? TextGenerators.getMonitorMessagesList(statusMessages) : "Новых сообщений нет";

      this.bot.sendMessage(msg.chat.id, message);
    }
    catch (error) {
      let message = `⚠️ Не удалось получить статус, может что-то с инетом, электричеством или le-fail?`;
      this.bot.sendMessage(msg.chat.id, message);
      logger.error(error);
    }
  }

  queryStatusMonitor = async () => {
    return await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/statusmonitor`))?.json();
  }

  enableStatusMonitor() {
    setInterval(() => this.monitorHandler({ chat: { id: botConfig.chats.test } }), embassyApiConfig.queryMonitorInterval);
  }

  printersHandler = async (msg) => {
    let message = TextGenerators.getPrintersInfo();
    let inlineKeyboard = [
      [
        {
          text: "Статус Anette",
          callback_data: JSON.stringify({ command: "/printerstatus anette" }),
        },
        {
          text: "Статус Plumbus",
          callback_data: JSON.stringify({ command: "/printerstatus plumbus" }),
        },
      ],
    ]

    this.bot.sendMessage(msg.chat.id, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  };

  printerStatusHandler = async (msg, printername) => {
    try {
      console.log(`${embassyApiConfig.host}:${embassyApiConfig.port}/printer?printername=${printername}`);
      var { status, thumbnailBuffer, cam } = await (
        await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/printer?printername=${printername}`)
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
            text: `Обновить статус ${printername}`,
            callback_data: JSON.stringify({ command: `/printerstatus ${printername}` }),
          },
        ],
      ]

      if (thumbnailBuffer) await this.bot.sendPhoto(msg.chat.id, Buffer.from(thumbnailBuffer), {
        caption: message, reply_markup: {
          inline_keyboard: inlineKeyboard,
        }
      });
      else await this.bot.sendMessage(msg.chat.id, message, {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        }
      });
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


  sayinspaceHandler = async (msg, text) => {
    try {
      if (!text) {
        this.bot.sendMessage(msg.chat.id, `🗣 С помощью этой команды можно сказать что-нибудь на динамике в спейсе, например #\`/say Привет, хакеры#\``);
        return;
      }

      let response = await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/sayinspace`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });

      if (response.status === 200) await this.bot.sendMessage(msg.chat.id, "🗣 Сообщение отправлено на динамик");
      else throw Error("Failed to say in space");
    } catch (error) {
      let message = `⚠️ Не вышло сказать`;
      await this.bot.sendMessage(msg.chat.id, message);
      logger.error(error);
    }
  }

  playinspaceHandler = async (msg, link) => {
    try {
      if (!link) {
        this.bot.sendMessage(msg.chat.id, `🗣 С помощью этой команды можно воспроизвести любой звук по ссылке`);
        return;
      }

      let response = await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/playinspace`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ link })
      });

      if (response.status === 200) await this.bot.sendMessage(msg.chat.id, "🗣 Звук отправлен на динамик");
      else throw Error("Failed to play in space");
    } catch (error) {
      let message = `⚠️ Не вышло воспроизвести`;
      await this.bot.sendMessage(msg.chat.id, message);
      logger.error(error);
    }
  }
}

module.exports = EmbassyHanlers;
