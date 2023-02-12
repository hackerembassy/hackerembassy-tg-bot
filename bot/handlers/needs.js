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

    this.bot.sendMessage(msg.chat.id, message);
  };

  buyHandler = (msg, text) => {
    let requester = msg.from.username;

    NeedsRepository.addBuy(text, requester, new Date());

    let message = `🙏 ${this.bot.formatUsername(
      requester
    )} попросил кого-нибудь купить #\`${text}#\` по дороге в спейс.`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  boughtHandler = (msg, text) => {
    let buyer = msg.from.username;

    let need = NeedsRepository.getOpenNeedByText(text);

    if (!need || need.buyer) {
      this.bot.sendMessage(msg.chat.id, `🙄 Открытого запроса на покупку с таким именем не нашлось`);
      return;
    }

    let message = `✅ ${this.bot.formatUsername(buyer)} купил #\`${text}#\` в спейс`;

    NeedsRepository.closeNeed(text, buyer, new Date());

    this.bot.sendMessage(msg.chat.id, message);
  };
}

module.exports = NeedsHandlers;
