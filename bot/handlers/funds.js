const FundsRepository = require("../../repositories/fundsRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const ExportHelper = require("../../services/export");
const config = require("config");
const currencyConfig = config.get("currency");
const BaseHandlers = require("./base");

const CALLBACK_DATA_RESTRICTION = 20;

class FundsHandlers extends BaseHandlers {
  constructor() {
    super();
  }

  parseMoneyValue = (value) => {
    return Number(value.replaceAll(/(k|тыс|тысяч|т)/g, "000").replaceAll(",", ""));
  }

  fromPrivateChat = (msg) => {
    return msg?.chat.type === "private";
  };

  fundsHandler = async (msg) => {
    let funds = FundsRepository.getfunds().filter((p) => p.status === "open");
    let donations = FundsRepository.getDonations();
    let showAdmin = UsersHelper.hasRole(msg.from.username, "admin", "accountant") && (this.fromPrivateChat(msg) || this.bot.isAdminMode());

    let list = await TextGenerators.createFundList(funds, donations, {showAdmin});

    let message = `⚒ Вот наши текущие сборы:
      
${list}💸 Чтобы узнать, как нам помочь - жми /donate`;

    this.bot.sendLongMessage(msg.chat.id, message);
  };
  //funds

  fundHandler = async (msg, fundName) => {
    let funds = [FundsRepository.getfundByName(fundName)];
    let donations = FundsRepository.getDonationsForName(fundName);
    let showAdmin = UsersHelper.hasRole(msg.from.username, "admin", "accountant") && (this.fromPrivateChat(msg) || this.bot.isAdminMode());


    // telegram callback_data is restricted to 64 bytes
    let inlineKeyboard =
      fundName.length < CALLBACK_DATA_RESTRICTION
        ? [
            [
              {
                text: "Экспортнуть в CSV",
                callback_data: JSON.stringify({
                  command: "/ef",
                  params: [fundName],
                }),
              },
              {
                text: "Посмотреть диаграмму",
                callback_data: JSON.stringify({
                  command: "/ed",
                  params: [fundName],
                }),
              },
            ],
          ]
        : [];

    let list = await TextGenerators.createFundList(funds, donations, {showAdmin});

    let message = `${list}💸 Чтобы узнать, как нам помочь - жми /donate`;

    this.bot.sendMessage(msg.chat.id, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  };

  fundsallHandler = async (msg) => {
    let funds = FundsRepository.getfunds();
    let donations = FundsRepository.getDonations();
    let showAdmin = UsersHelper.hasRole(msg.from.username, "admin", "accountant") && (this.fromPrivateChat(msg) || this.bot.isAdminMode());

    let list = await TextGenerators.createFundList(funds, donations, {showAdmin, isHistory:true});

    this.bot.sendLongMessage(msg.chat.id, "💾 Вот архив всех наших сборов:\n\n" + list);
  };

  addFundHandler = (msg, fundName, target, currency) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    let targetValue = this.parseMoneyValue(target);
    currency = currency?.length > 0 ? currency.toUpperCase() : currencyConfig.default;

    let success = !isNaN(targetValue) && FundsRepository.addfund(fundName, targetValue, currency);
    let message = success
      ? `Добавлен сбор ${fundName} с целью в ${targetValue} ${currency}`
      : `Не удалось добавить сбор (может он уже есть?)`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  updateFundHandler = (msg, fundName, target, currency, newFund) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    let targetValue = this.parseMoneyValue(target);
    currency = currency?.length > 0 ? currency.toUpperCase() : currencyConfig.default;
    let newFundName = newFund?.length > 0 ? newFund : fundName;

    let success = !isNaN(targetValue) && FundsRepository.updatefund(fundName, targetValue, currency, newFundName);
    let message = success
      ? `Обновлен сбор ${fundName} с новой целью в ${targetValue} ${currency}`
      : `Не удалось обновить сбор (может не то имя?)`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  removeFundHandler = (msg, fundName) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    let success = FundsRepository.removefund(fundName);
    let message = success ? `Удален сбор ${fundName}` : `Не удалось удалить сбор`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  async exportFundHandler(msg, fundName) {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    let csvBuffer = await ExportHelper.exportFundToCSV(fundName);

    if (!csvBuffer?.length) {
      this.bot.sendMessage(msg.chat.id, "Нечего экспортировать");
      return;
    }

    const fileOptions = {
      filename: `${fundName} donations.csv`,
      contentType: "text/csv",
    };

    this.bot.sendDocument(msg.chat.id, csvBuffer, {}, fileOptions);
  }

  closeFundHandler = (msg, fundName) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    let success = FundsRepository.closefund(fundName);
    let message = success ? `Закрыт сбор ${fundName}` : `Не удалось закрыть сбор`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  changeFundStatusHandler = (msg, fundName, fundStatus) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    fundStatus = fundStatus.toLowerCase();

    let success = FundsRepository.changefundStatus(fundName, fundStatus);
    let message = success ? `Статус сбора ${fundName} изменен на ${fundStatus}` : `Не удалось изменить статус сбора`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  transferDonationHandler = (msg, id, accountant) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    accountant = accountant.replace("@", "");

    let success = FundsRepository.transferDonation(id, accountant);
    let message = success ? `Донат ${id} передан ${this.bot.formatUsername(accountant)}` : `Не удалось передать донат`;
    
    this.bot.sendMessage(msg.chat.id, message);
  };

  addDonationHandler = async (msg, value, currency, userName, fundName) => {
    if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

    value = this.parseMoneyValue(value);
    currency = currency.length > 0 ? currency.toUpperCase() : currencyConfig.default;
    userName = userName.replace("@", "");
    let accountant = msg.from.username;

    let success = !isNaN(value) && FundsRepository.addDonationTo(fundName, userName, value, currency, accountant);
    let message = success
      ? `💸 ${this.bot.formatUsername(userName)} задонатил ${value} ${currency} в сбор ${fundName}`
      : `Не удалось добавить донат`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  costsHandler = async (msg, value, currency, userName) => {
    if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

    value = this.parseMoneyValue(value);
    currency = currency.length > 0 ? currency.toUpperCase() : currencyConfig.default;
    userName = userName.replace("@", "");
    let fundName = FundsRepository.getLatestCosts().name;
    let accountant = msg.from.username;

    let success = !isNaN(value) && FundsRepository.addDonationTo(fundName, userName, value, currency, accountant);
    let message = success
      ? `💸 ${this.bot.formatUsername(userName)} задонатил ${value} ${currency} в сбор ${fundName}`
      : `Не удалось добавить донат`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  removeDonationHandler = (msg, donationId) => {
    if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;
    

    let success = FundsRepository.removeDonationById(donationId);
    let message = success ? `Удален донат [id:${donationId}]` : `Не удалось удалить донат (может его и не было?)`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  changeDonationHandler = (msg, donationId, value, currency) => {
    if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

    value = this.parseMoneyValue(value);
    currency = currency.length > 0 ? currency.toUpperCase() : currencyConfig.default;

    let success = FundsRepository.updateDonation(donationId, value, currency);
    let message = success ? `Обновлен донат [id:${donationId}]` : `Не удалось обновить донат (может его и не было?)`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  exportDonutHandler = async (msg, fundName) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    let imageBuffer;
    try {
      imageBuffer = await ExportHelper.exportFundToDonut(fundName);
    } catch (error) {
      this.bot.sendMessage(msg.chat.id, "Что-то не так");
      return;
    }

    if (!imageBuffer?.length) {
      this.bot.sendMessage(msg.chat.id, "Нечего экспортировать");
      return;
    }

    this.bot.sendPhoto(msg.chat.id, imageBuffer);
  };
}

module.exports = FundsHandlers;
