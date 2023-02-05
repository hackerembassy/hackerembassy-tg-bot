const UsersHelper = require("../../services/usersHelper");
const { popLast } = require("../botExtensions");
const BaseHandlers = require("./base");
const StatusHandlers = new (require("./status"));
const FundsHandlers = new (require("./funds"));

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
      case "/open":
        StatusHandlers.openHandler(message);
        break;
      case "/close":
        StatusHandlers.closeHandler(message);
        break;
      case "/status":
        StatusHandlers.statusHandler(message);
        break;
      case "/ef":
        FundsHandlers.exportFundHandler(message, ...data.params);
        break;
      case "/ed":
        FundsHandlers.exportDonutHandler(message, ...data.params);
        break;
      default:
        break;
    }

    this.bot.answerCallbackQuery(callbackQuery.id);
  }

  newMemberHandler = async (msg) => {
    let botName = (await this.bot.getMe()).username;
    let newMembers = msg.new_chat_members.reduce((res, member) => res + `${this.tag()}${member.username} `, "");
    let message = `🇬🇧 Добро пожаловать в наш уютный уголок, ${newMembers}
      
Я @${botName}, бот-менеджер хакерспейса. Ко мне в личку можно зайти пообщаться, вбить мои команды, и я расскажу вкратце о нас.
🎉🎉🎉 Хакерчане, приветствуем ${newMembers}`;
    this.bot.sendMessage(msg.chat.id, message);
  };
}

module.exports = ServiceHandlers;
