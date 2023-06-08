const FundsRepository = require("../../repositories/fundsRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const ExportHelper = require("../../services/export");
const BaseHandlers = require("./base");
const {prepareCurrency, parseMoneyValue} = require("../../utils/currency");
const logger = require("../../services/logger");

const CALLBACK_DATA_RESTRICTION = 20;

class FundsHandlers extends BaseHandlers {
  constructor() {
    super();
  }

  fundsHandler = async (msg) => {
    let funds = FundsRepository.getFunds().filter((p) => p.status === "open");
    let donations = FundsRepository.getDonations();
    let showAdmin =
      UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
      (this.bot.IsMessageFromPrivateChat(msg) || this.bot.isAdminMode());

    let list = await TextGenerators.createFundList(funds, donations, { showAdmin });

    let message = `⚒ Вот наши текущие сборы:
      
${list}💸 Чтобы узнать, как нам помочь - жми /donate`;

    this.bot.sendLongMessage(msg.chat.id, message);
  };

  fundHandler = async (msg, fundName) => {
    let funds = [FundsRepository.getFundByName(fundName)];
    let donations = FundsRepository.getDonationsForName(fundName);
    let showAdmin =
      UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
      (this.bot.IsMessageFromPrivateChat(msg) || this.bot.isAdminMode());

    // telegram callback_data is restricted to 64 bytes
    let inlineKeyboard =
      fundName.length < CALLBACK_DATA_RESTRICTION
        ? [
            [
              {
                text: "🧾 Экспортнуть в CSV",
                callback_data: JSON.stringify({
                  command: "/ef",
                  params: [fundName],
                }),
              },
              {
                text: "📊 Посмотреть диаграмму",
                callback_data: JSON.stringify({
                  command: "/ed",
                  params: [fundName],
                }),
              },
            ],
          ]
        : [];

    let list = await TextGenerators.createFundList(funds, donations, { showAdmin });

    let message = `${list}💸 Чтобы узнать, как нам помочь - жми /donate`;

    this.bot.sendMessage(msg.chat.id, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  };

  fundsallHandler = async (msg) => {
    let funds = FundsRepository.getFunds();
    let donations = FundsRepository.getDonations();
    let showAdmin =
      UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
      (this.bot.IsMessageFromPrivateChat(msg) || this.bot.isAdminMode());

    let list = await TextGenerators.createFundList(funds, donations, { showAdmin, isHistory: true });

    this.bot.sendLongMessage(msg.chat.id, "💾 Вот архив всех наших сборов:\n\n" + list);
  };

  addFundHandler = async (msg, fundName, target, currency) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    let targetValue = parseMoneyValue(target);
    currency = await prepareCurrency(currency);

    let success = !isNaN(targetValue) && FundsRepository.addFund(fundName, targetValue, currency);
    let message = success
      ? `💰 Добавлен сбор ${fundName} с целью в ${targetValue} ${currency}`
      : `⚠️ Не удалось добавить сбор (может он уже есть?)`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  updateFundHandler = async (msg, fundName, target, currency, newFund) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    let targetValue = parseMoneyValue(target);
    currency = await prepareCurrency(currency);
    let newFundName = newFund?.length > 0 ? newFund : fundName;

    let success = !isNaN(targetValue) && FundsRepository.updateFund(fundName, targetValue, currency, newFundName);
    let message = success
      ? `🔄 Обновлен сбор ${fundName} с новой целью в ${targetValue} ${currency}`
      : `⚠️ Не удалось обновить сбор (может не то имя?)`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  removeFundHandler = (msg, fundName) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    let success = FundsRepository.removeFund(fundName);
    let message = success ? `🗑 Удален сбор ${fundName}` : `⚠️ Не удалось удалить сбор`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  closeFundHandler = (msg, fundName) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    let success = FundsRepository.closeFund(fundName);
    let message = success ? `☑️ Закрыт сбор ${fundName}` : `⚠️ Не удалось закрыть сбор`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  changeFundStatusHandler = (msg, fundName, fundStatus) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    fundStatus = fundStatus.toLowerCase();

    let success = FundsRepository.changeFundStatus(fundName, fundStatus);
    let message = success ? `✳️ Статус сбора ${fundName} изменен на ${fundStatus}` : `⚠️ Не удалось изменить статус сбора`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  transferDonationHandler = (msg, id, accountant) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    accountant = accountant.replace("@", "");

    let success = FundsRepository.transferDonation(id, accountant);
    let message = `⚠️ Не удалось передать донат`;

    if (success) {
      let donation = FundsRepository.getDonationById(id);
      let fund = FundsRepository.getFundById(donation.fund_id);
      message = `↪️ Донат [id:${id}] передан ${this.bot.formatUsername(accountant)}
${this.bot.formatUsername(donation.username)} донатил в сбор ${fund.name} в размере ${donation.value} ${donation.currency}`;
    }

    this.bot.sendMessage(msg.chat.id, message);
  };

  addDonationHandler = async (msg, value, currency, userName, fundName) => {
    if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

    value = parseMoneyValue(value);
    currency = await prepareCurrency(currency);
    userName = userName.replace("@", "");
    let accountant = msg.from.username;

    let success = !isNaN(value) && FundsRepository.addDonationTo(fundName, userName, value, currency, accountant);
    let message = success
      ? `💸 ${this.bot.formatUsername(userName)} задонатил ${value} ${currency} в сбор ${fundName}`
      : `⚠️ Не удалось добавить донат (может с валютой или суммой что-то не так?)`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  costsHandler = async (msg, value, currency, userName) => {
    if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

    value = parseMoneyValue(value);
    currency = await prepareCurrency(currency);
    userName = userName.replace("@", "");
    let fundName = FundsRepository.getLatestCosts().name;
    let accountant = msg.from.username;

    let success = !isNaN(value) && FundsRepository.addDonationTo(fundName, userName, value, currency, accountant);
    let message = success
      ? `💸 ${this.bot.formatUsername(userName)} задонатил ${value} ${currency} в сбор ${fundName}`
      : `⚠️ Не удалось добавить донат (может с валютой или суммой что-то не так?)`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  showCostsHandler = async (msg) => {
    let fundName = FundsRepository.getLatestCosts().name;

    return this.fundHandler(msg, fundName)
  };

  showCostsDonutHandler = async (msg) => {
    let fundName = FundsRepository.getLatestCosts().name;

    return this.exportDonutHandler(msg, fundName)
  };

  removeDonationHandler = (msg, donationId) => {
    if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

    let success = FundsRepository.removeDonationById(donationId);
    let message = success ? `🗑 Удален донат [id:${donationId}]` : `⚠️ Не удалось удалить донат (может его и не было?)`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  changeDonationHandler = async (msg, donationId, value, currency) => {
    if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

    value = parseMoneyValue(value);
    currency = await prepareCurrency(currency);

    let success = FundsRepository.updateDonation(donationId, value, currency);
    let message = success ? `🔄 Обновлен донат [id:${donationId}]` : `⚠️ Не удалось обновить донат (может его и не было?)`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  exportCSVHandler = async (msg, fundName) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    try {
      let csvBuffer = await ExportHelper.exportFundToCSV(fundName);

      if (!csvBuffer?.length) {
        this.bot.sendMessage(msg.chat.id, "⚠️ Нечего экспортировать");
        return;
      }

      const fileOptions = {
        filename: `${fundName} donations.csv`,
        contentType: "text/csv",
      };

      await this.bot.sendDocument(msg.chat.id, csvBuffer, {}, fileOptions);
    } 
    catch (error) {
      logger.error(error);
      this.bot.sendMessage(msg.chat.id, "⚠️ Что-то не так");
    }
  }

  exportDonutHandler = async (msg, fundName) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

    let imageBuffer;
    try {
      imageBuffer = await ExportHelper.exportFundToDonut(fundName);

      if (!imageBuffer?.length) {
        this.bot.sendMessage(msg.chat.id, "⚠️ Нечего экспортировать");
        return;
      }

      await this.bot.sendPhoto(msg.chat.id, imageBuffer);
    } 
    catch (error) {
      logger.error(error);
      this.bot.sendMessage(msg.chat.id, "⚠️ Что-то не так");
    }
  };
}

module.exports = FundsHandlers;
