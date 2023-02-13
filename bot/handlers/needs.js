const NeedsRepository = require("../../repositories/needsRepository");
const TextGenerators = require("../../services/textGenerators");
const BaseHandlers = require("./base");
const UsersHelper = require("../../services/usersHelper");

class NeedsHandlers extends BaseHandlers {
  constructor() {
    super();
  }

  needsHandler = (msg) => {
    let needs = NeedsRepository.getOpenNeeds();
    let message = TextGenerators.getNeedsList(needs);

    this.bot.sendMessage(msg.chat.id, message, {
      "reply_markup": {
          "inline_keyboard": needs.map((need) => [{
              text: need.text,
              callback_data: JSON.stringify({ command: "/bought", id: need.id }),
          },])
      }
    });
  };

  buyHandler = (msg, text) => {
    let requester = msg.from.username;

    NeedsRepository.addBuy(text, requester, new Date());

    let message = `🙏 ${this.bot.formatUsername(
      requester
    )} попросил кого-нибудь купить #\`${text}#\` по дороге в спейс.`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  boughtByIdHandler = (msg, id) => {
    let need = NeedsRepository.getNeedById(id);
    this.boughtHandler(msg, need.text || "");
  }

  boughtUndoHandler = (msg, id) => {
    const need = NeedsRepository.getNeedById(id);
    if (need && need.buyer === msg.from.username) {
      NeedsRepository.undoClose(need.id);
      return true;
    }
    return false;
  }

  boughtHandler = (msg, text) => {
    let buyer = msg.from.username;

    let need = NeedsRepository.getOpenNeedByText(text);

    if (!need || need.buyer) {
      this.bot.sendMessage(msg.chat.id, `🙄 Открытого запроса на покупку с таким именем не нашлось`);
      return;
    }

    let message = `✅ ${this.bot.formatUsername(buyer)} купил #\`${text}#\` в спейс`;

    const id = NeedsRepository.closeNeed(text, buyer, new Date());

    this.bot.sendMessage(msg.chat.id, message, {
      "reply_markup": {
          "inline_keyboard": [[{
              text: "Отменить покупку",
              callback_data: JSON.stringify({ command: "/bought_undo", id: id }),
          },],]
      }
    });
  };
}

module.exports = NeedsHandlers;
