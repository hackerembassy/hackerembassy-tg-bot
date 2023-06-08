const UsersHelper = require("../../services/usersHelper");
const { popLast } = require("../botExtensions");
const BaseHandlers = require("./base");
const StatusHandlers = new (require("./status"));
const FundsHandlers = new (require("./funds"));
const NeedsHandlers = new (require("./needs"));
const BirthdayHandlers = new (require("./birthday"));
const BasicHandlers = new (require("./basic"));
const EmbassyHandlers = new (require("./embassy"));

class ServiceHandlers extends BaseHandlers {
  constructor() {
    super();
  }

  clearHandler = (msg, count) => {
    if (!UsersHelper.hasRole(msg.from.username, "member")) return;

    let inputCount = Number(count);
    let countToClear = inputCount > 0 ? inputCount : 1;
    let idsToRemove = popLast(msg.chat.id, countToClear);

    for (const id of idsToRemove) {
      this.bot.deleteMessage(msg.chat.id, id);
    }
  }

  superstatusHandler = async (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "member", "admin")) return;

    await StatusHandlers.statusHandler(msg);
    await EmbassyHandlers.webcamHandler(msg);
    await EmbassyHandlers.webcam2Handler(msg);
    await EmbassyHandlers.doorcamHandler(msg);
  }

  callbackHandler = (callbackQuery) => {
    const message = callbackQuery.message;
    const data = JSON.parse(callbackQuery.data);
    message.from = callbackQuery.from;

    switch (data.command) {
      case "/in":
        StatusHandlers.inHandler(message);
        break;
      case "/out":
        StatusHandlers.outHandler(message);
        break;
      case "/going":
        StatusHandlers.goingHandler(message);
        break;
      case "/notgoing":
        StatusHandlers.notGoingHandler(message);
        break;
      case "/open":
        StatusHandlers.openHandler(message);
        break;
      case "/close":
        StatusHandlers.closeHandler(message);
        break;
      case "/status":
        StatusHandlers.statusHandler(message);
        break;
      case "/ustatus":
        StatusHandlers.statusHandler(message, true);
        break;
      case "/superstatus":
        this.superstatusHandler(message);
        break;
      case "/birthdays":
        BirthdayHandlers.birthdayHandler(message);
        break;
      case "/needs":
        NeedsHandlers.needsHandler(message);
        break;
      case "/funds":
        FundsHandlers.fundsHandler(message);
        break;
      case "/startpanel":
        BasicHandlers.startPanelHandler(message, true);
        break;
      case "/infopanel":
        BasicHandlers.infoPanelHandler(message, true);
        break;
      case "/controlpanel":
        BasicHandlers.controlPanelHandler(message, true);
        break;
      case "/about":
        BasicHandlers.aboutHandler(message);
        break;
      case "/help":
        BasicHandlers.helpHandler(message);
        break;
      case "/donate":
        BasicHandlers.donateHandler(message);
        break;
      case "/join":
        BasicHandlers.joinHandler(message);
        break;
      case "/location":
        BasicHandlers.locationHandler(message);
        break;
      case "/getresidents":
        BasicHandlers.getResidentsHandler(message);
        break;
      case "/ef":
        FundsHandlers.exportCSVHandler(message, ...data.params);
        break;
      case "/ed":
        FundsHandlers.exportDonutHandler(message, ...data.params);
        break;
      case "/unlock":
        EmbassyHandlers.unlockHandler(message);
        break;
      case "/doorbell":
        EmbassyHandlers.doorbellHandler(message);
        break;
      case "/webcam":
        EmbassyHandlers.webcamHandler(message);
        break;
      case "/webcam2":
        EmbassyHandlers.webcam2Handler(message);
        break;
      case "/doorcam":
        EmbassyHandlers.doorcamHandler(message);
        break;
      case "/printer":
        EmbassyHandlers.printerHandler(message);
        break;
      case "/printerstatus":
        EmbassyHandlers.printerStatusHandler(message);
      break;
      case "/bought":
        NeedsHandlers.boughtByIdHandler(message, data.id);
        const new_keyboard = message.reply_markup.inline_keyboard.filter(
          (button) => button[0].callback_data !== callbackQuery.data
        );
        if (new_keyboard.length != message.reply_markup.inline_keyboard.length) {
          this.bot.editMessageReplyMarkup(
            { inline_keyboard: new_keyboard },
            {
              chat_id: message.chat.id,
              message_id: message.message_id,
            }
          );
        }
        break;
      case "/bought_undo":
        const res = NeedsHandlers.boughtUndoHandler(message, data.id);
        if (res) {
          this.bot.deleteMessage(message.chat.id, message.message_id);
        }
        break;
      default:
        break;
    }

    this.bot.answerCallbackQuery(callbackQuery.id);
  }

  newMemberHandler = async (msg) => {
    let botName = (await this.bot.getMe()).username;
    let newMembers = msg.new_chat_members.reduce((res, member) => res + `${member?.username ? this.bot.formatUsername(member.username) : member?.first_name} `, "");
    let message = `🇬🇧 Добро пожаловать в наш уютный уголок, ${newMembers}
      
Я @${botName}, бот-менеджер хакерспейса. Ко мне в личку можно зайти пообщаться, вбить мои команды, и я расскажу вкратце о нас.
Не забудь также подписаться на наш второй чатик @hackem_foo. Там найдешь топики по основным проектам спейса, обсуждения будущих мероприятий, новостей, мемов etc.

🎉🎉🎉 Хакерчане, приветствуем ${newMembers}`;
    this.bot.sendMessage(msg.chat.id, message);
  };
}

module.exports = ServiceHandlers;
