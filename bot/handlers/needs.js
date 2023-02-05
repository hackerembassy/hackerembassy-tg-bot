const NeedsRepository = require("../../repositories/needsRepository");
const TextGenerators = require("../../services/textGenerators");
const BaseHandlers = require("./base");

class NeedsHandlers extends BaseHandlers {
  constructor() {
    super();
  }

  needsHandler = (msg) => {
    let needs = NeedsRepository.getOpenNeeds();
    let message = TextGenerators.getNeedsList(needs, this.tag());

    this.bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
  };

  buyHandler = (msg, text) => {
    let requester = msg.from.username;

    NeedsRepository.addBuy(text, requester, new Date());

    let message = `🙏 ${this.tag()}${TextGenerators.excapeUnderscore(
      requester
    )} попросил кого-нибудь купить \`${text}\` по дороге в спейс.`;

    this.bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
  };

  boughtHandler = (msg, text) => {
    let buyer = msg.from.username;

    let need = NeedsRepository.getOpenNeedByText(text);

    if (!need || need.buyer) {
      this.bot.sendMessage(msg.chat.id, `🙄 Открытого запроса на покупку с таким именем не нашлось`);
      return;
    }

    let message = `✅ ${this.tag()}${TextGenerators.excapeUnderscore(buyer)} купил \`${text}\` в спейс`;

    NeedsRepository.closeNeed(text, buyer, new Date());

    this.bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
  };
}

module.exports = NeedsHandlers;
