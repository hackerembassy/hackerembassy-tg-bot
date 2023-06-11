const FundsRepository = require("../../repositories/fundsRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const ExportHelper = require("../../services/export");
const { prepareCurrency, parseMoneyValue } = require("../../utils/currency");
const logger = require("../../services/logger");

const CALLBACK_DATA_RESTRICTION = 20;

class FundsHandlers {
    static bot;

    static fundsHandler = async (bot, msg) => {
        let funds = FundsRepository.getFunds().filter(p => p.status === "open");
        let donations = FundsRepository.getDonations();
        let showAdmin =
            UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
            (bot.IsMessageFromPrivateChat(msg) || bot.isAdminMode());

        let list = await TextGenerators.createFundList(funds, donations, { showAdmin }, bot.mode);

        let message = `⚒ Вот наши текущие сборы:
      
${list}💸 Чтобы узнать, как нам помочь - жми /donate`;

        bot.sendLongMessage(msg.chat.id, message);
    };

    static fundHandler = async (bot, msg, fundName) => {
        let funds = [FundsRepository.getFundByName(fundName)];
        let donations = FundsRepository.getDonationsForName(fundName);
        let showAdmin =
            UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
            (bot.IsMessageFromPrivateChat(msg) || bot.isAdminMode());

        // telegram callback_data is restricted to 64 bytes
        let inlineKeyboard =
            fundName.length < CALLBACK_DATA_RESTRICTION
                ? [
                      [
                          {
                              text: "🧾 Экспорт в CSV",
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

        let list = await TextGenerators.createFundList(funds, donations, { showAdmin }, bot.mode);

        let message = `${list}💸 Чтобы узнать, как нам помочь - жми /donate`;

        bot.sendMessage(msg.chat.id, message, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    };

    static fundsallHandler = async (bot, msg) => {
        let funds = FundsRepository.getFunds();
        let donations = FundsRepository.getDonations();
        let showAdmin =
            UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
            (bot.IsMessageFromPrivateChat(msg) || bot.isAdminMode());

        let list = await TextGenerators.createFundList(funds, donations, { showAdmin, isHistory: true }, bot.mode);

        bot.sendLongMessage(msg.chat.id, "💾 Вот архив всех наших сборов:\n\n" + list);
    };

    static addFundHandler = async (bot, msg, fundName, target, currency) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

        let targetValue = parseMoneyValue(target);
        currency = await prepareCurrency(currency);

        let success = !isNaN(targetValue) && FundsRepository.addFund(fundName, targetValue, currency);
        let message = success
            ? `💰 Добавлен сбор ${fundName} с целью в ${targetValue} ${currency}`
            : `⚠️ Не удалось добавить сбор (может он уже есть?)`;

        bot.sendMessage(msg.chat.id, message);
    };

    static updateFundHandler = async (bot, msg, fundName, target, currency, newFund) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

        let targetValue = parseMoneyValue(target);
        currency = await prepareCurrency(currency);
        let newFundName = newFund?.length > 0 ? newFund : fundName;

        let success = !isNaN(targetValue) && FundsRepository.updateFund(fundName, targetValue, currency, newFundName);
        let message = success
            ? `🔄 Обновлен сбор ${fundName} с новой целью в ${targetValue} ${currency}`
            : `⚠️ Не удалось обновить сбор (может не то имя?)`;

        bot.sendMessage(msg.chat.id, message);
    };

    static removeFundHandler = (bot, msg, fundName) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

        let success = FundsRepository.removeFund(fundName);
        let message = success ? `🗑 Удален сбор ${fundName}` : `⚠️ Не удалось удалить сбор`;

        bot.sendMessage(msg.chat.id, message);
    };

    static closeFundHandler = (bot, msg, fundName) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

        let success = FundsRepository.closeFund(fundName);
        let message = success ? `☑️ Закрыт сбор ${fundName}` : `⚠️ Не удалось закрыть сбор`;

        bot.sendMessage(msg.chat.id, message);
    };

    static changeFundStatusHandler = (bot, msg, fundName, fundStatus) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

        fundStatus = fundStatus.toLowerCase();

        let success = FundsRepository.changeFundStatus(fundName, fundStatus);
        let message = success ? `✳️ Статус сбора ${fundName} изменен на ${fundStatus}` : `⚠️ Не удалось изменить статус сбора`;

        bot.sendMessage(msg.chat.id, message);
    };

    static transferDonationHandler = (bot, msg, id, accountant) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

        accountant = accountant.replace("@", "");

        let success = FundsRepository.transferDonation(id, accountant);
        let message = `⚠️ Не удалось передать донат`;

        if (success) {
            let donation = FundsRepository.getDonationById(id);
            let fund = FundsRepository.getFundById(donation.fund_id);
            message = `↪️ Донат [id:${id}] передан ${UsersHelper.formatUsername(accountant, bot.mode)}
${UsersHelper.formatUsername(donation.username, bot.mode)} донатил в сбор ${fund.name} в размере ${donation.value} ${
                donation.currency
            }`;
        }

        bot.sendMessage(msg.chat.id, message);
    };

    static addDonationHandler = async (bot, msg, value, currency, userName, fundName) => {
        if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

        value = parseMoneyValue(value);
        currency = await prepareCurrency(currency);
        userName = userName.replace("@", "");
        let accountant = msg.from.username;

        let success = !isNaN(value) && FundsRepository.addDonationTo(fundName, userName, value, currency, accountant);
        let message = success
            ? `💸 ${UsersHelper.formatUsername(userName, bot.mode)} задонатил ${value} ${currency} в сбор ${fundName}`
            : `⚠️ Не удалось добавить донат (может с валютой или суммой что-то не так?)`;

        bot.sendMessage(msg.chat.id, message);
    };

    static costsHandler = async (bot, msg, value, currency, userName) => {
        if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

        value = parseMoneyValue(value);
        currency = await prepareCurrency(currency);
        userName = userName.replace("@", "");
        let fundName = FundsRepository.getLatestCosts().name;
        let accountant = msg.from.username;

        let success = !isNaN(value) && FundsRepository.addDonationTo(fundName, userName, value, currency, accountant);
        let message = success
            ? `💸 ${UsersHelper.formatUsername(userName, bot.mode)} задонатил ${value} ${currency} в сбор ${fundName}`
            : `⚠️ Не удалось добавить донат (может с валютой или суммой что-то не так?)`;

        bot.sendMessage(msg.chat.id, message);
    };

    static showCostsHandler = async (bot, msg) => {
        let fundName = FundsRepository.getLatestCosts()?.name;

        if (!fundName) {
            bot.sendMessage(msg.chat.id, "Текущий сбор на аренду не найден");
            return;
        }

        return this.fundHandler(bot, msg, fundName);
    };

    static showCostsDonutHandler = async (bot, msg) => {
        let fundName = FundsRepository.getLatestCosts().name;

        return this.exportDonutHandler(bot, msg, fundName);
    };

    static removeDonationHandler = (bot, msg, donationId) => {
        if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

        let success = FundsRepository.removeDonationById(donationId);
        let message = success ? `🗑 Удален донат [id:${donationId}]` : `⚠️ Не удалось удалить донат (может его и не было?)`;

        bot.sendMessage(msg.chat.id, message);
    };

    static changeDonationHandler = async (bot, msg, donationId, value, currency) => {
        if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

        value = parseMoneyValue(value);
        currency = await prepareCurrency(currency);

        let success = FundsRepository.updateDonation(donationId, value, currency);
        let message = success ? `🔄 Обновлен донат [id:${donationId}]` : `⚠️ Не удалось обновить донат (может его и не было?)`;

        bot.sendMessage(msg.chat.id, message);
    };

    static exportCSVHandler = async (bot, msg, fundName) => {
        try {
            let csvBuffer = await ExportHelper.exportFundToCSV(fundName);

            if (!csvBuffer?.length) {
                bot.sendMessage(msg.chat.id, "⚠️ Нечего экспортировать");
                return;
            }

            const fileOptions = {
                filename: `${fundName} donations.csv`,
                contentType: "text/csv",
            };

            await bot.sendDocument(msg.chat.id, csvBuffer, {}, fileOptions);
        } catch (error) {
            logger.error(error);
            bot.sendMessage(msg.chat.id, "⚠️ Что-то не так");
        }
    };

    static exportDonutHandler = async (bot, msg, fundName) => {
        let imageBuffer;
        try {
            imageBuffer = await ExportHelper.exportFundToDonut(fundName);

            if (!imageBuffer?.length) {
                bot.sendMessage(msg.chat.id, "⚠️ Нечего экспортировать");
                return;
            }

            await bot.sendPhoto(msg.chat.id, imageBuffer);
        } catch (error) {
            logger.error(error);
            bot.sendMessage(msg.chat.id, "⚠️ Что-то не так");
        }
    };
}

module.exports = FundsHandlers;
