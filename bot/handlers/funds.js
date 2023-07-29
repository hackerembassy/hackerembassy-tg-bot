const FundsRepository = require("../../repositories/fundsRepository");
const { isMessageFromPrivateChat } = require("../bot-helpers");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const ExportHelper = require("../../services/export");
const { prepareCurrency, parseMoneyValue } = require("../../utils/currency");
const logger = require("../../services/logger");
const t = require("../../services/localization");

const CALLBACK_DATA_RESTRICTION = 20;

class FundsHandlers {
    static fundsHandler = async (bot, msg) => {
        const funds = FundsRepository.getFunds().filter(p => p.status === "open");
        const donations = FundsRepository.getDonations();
        const showAdmin =
            UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
            (isMessageFromPrivateChat(msg) || bot.context.isAdminMode());

        const list = await TextGenerators.createFundList(funds, donations, { showAdmin }, bot.context.mode);

        await bot.sendLongMessage(msg.chat.id, t("funds.funds", { list }));
    };

    static fundHandler = async (bot, msg, fundName) => {
        const funds = [FundsRepository.getFundByName(fundName)];
        const donations = FundsRepository.getDonationsForName(fundName);
        const showAdmin =
            UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
            (isMessageFromPrivateChat(msg) || bot.context.isAdminMode());

        // telegram callback_data is restricted to 64 bytes
        const inlineKeyboard =
            fundName.length < CALLBACK_DATA_RESTRICTION
                ? [
                      [
                          {
                              text: t("funds.fund.buttons.csv"),
                              callback_data: JSON.stringify({
                                  command: "/ef",
                                  params: [fundName],
                              }),
                          },
                          {
                              text: t("funds.fund.buttons.donut"),
                              callback_data: JSON.stringify({
                                  command: "/ed",
                                  params: [fundName],
                              }),
                          },
                      ],
                  ]
                : [];

        const fundlist = await TextGenerators.createFundList(funds, donations, { showAdmin }, bot.context.mode);

        await bot.sendMessage(msg.chat.id, t("funds.fund.text", { fundlist }), {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    };

    static fundsallHandler = async (bot, msg) => {
        const funds = FundsRepository.getFunds();
        const donations = FundsRepository.getDonations();
        const showAdmin =
            UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
            (isMessageFromPrivateChat(msg) || bot.context.isAdminMode());

        const list = await TextGenerators.createFundList(funds, donations, { showAdmin, isHistory: true }, bot.context.mode);

        await bot.sendLongMessage(msg.chat.id, t("funds.fundsall", { list }));
    };

    static addFundHandler = async (bot, msg, fundName, target, currency) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

        const targetValue = parseMoneyValue(target);
        currency = await prepareCurrency(currency);

        const success = !isNaN(targetValue) && FundsRepository.addFund(fundName, targetValue, currency);

        await bot.sendMessage(
            msg.chat.id,
            success ? t("funds.addfund.success", { fundName, targetValue, currency }) : t("funds.addfund.fail")
        );
    };

    static updateFundHandler = async (bot, msg, fundName, target, currency, newFund) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

        const targetValue = parseMoneyValue(target);
        currency = await prepareCurrency(currency);
        const newFundName = newFund?.length > 0 ? newFund : fundName;

        const success = !isNaN(targetValue) && FundsRepository.updateFund(fundName, targetValue, currency, newFundName);

        await bot.sendMessage(
            msg.chat.id,
            success ? t("funds.updatefund.success", { fundName, targetValue, currency }) : t("funds.updatefund.fail")
        );
    };

    static removeFundHandler = async (bot, msg, fundName) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

        const success = FundsRepository.removeFund(fundName);

        await bot.sendMessage(msg.chat.id, success ? t("funds.removefund.success", { fundName }) : t("funds.removefund.fail"));
    };

    static closeFundHandler = async (bot, msg, fundName) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

        const success = FundsRepository.closeFund(fundName);

        await bot.sendMessage(msg.chat.id, success ? t("funds.closefund.success", { fundName }) : t("funds.closefund.fail"));
    };

    static changeFundStatusHandler = (bot, msg, fundName, fundStatus) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

        fundStatus = fundStatus.toLowerCase();

        const success = FundsRepository.changeFundStatus(fundName, fundStatus);

        bot.sendMessage(
            msg.chat.id,
            success ? t("funds.changestatus.success", { fundName, fundStatus }) : t("funds.changestatus.fail")
        );
    };

    static transferDonationHandler = async (bot, msg, id, accountant) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

        accountant = accountant.replace("@", "");

        const success = FundsRepository.transferDonation(id, accountant);
        let text = t("funds.transferdonation.fail");

        if (success) {
            const donation = FundsRepository.getDonationById(id);
            const fund = FundsRepository.getFundById(donation.fund_id);
            text = t("funds.transferdonation.success", {
                id,
                accountant: UsersHelper.formatUsername(accountant, bot.context.mode),
                username: UsersHelper.formatUsername(donation.username, bot.context.mode),
                fund,
                donation,
            });
        }

        await bot.sendMessage(msg.chat.id, text);
    };

    static addDonationHandler = async (bot, msg, value, currency, userName, fundName) => {
        if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

        value = parseMoneyValue(value);
        currency = await prepareCurrency(currency);
        userName = userName.replace("@", "");
        const accountant = msg.from.username;

        const hasAlreadyDonated =
            FundsRepository.getDonationsForName(fundName)?.filter(donation => donation.username === userName)?.length > 0;

        const success = !isNaN(value) && FundsRepository.addDonationTo(fundName, userName, value, currency, accountant);
        const text = success
            ? t(hasAlreadyDonated ? "funds.adddonation.increased" : "funds.adddonation.success", {
                  username: UsersHelper.formatUsername(userName, bot.context.mode),
                  value,
                  currency,
                  fundName,
              })
            : t("funds.adddonation.fail");

        await bot.sendMessage(msg.chat.id, text);
    };

    static costsHandler = async (bot, msg, value, currency, userName) => {
        if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

        return this.addDonationHandler(bot, msg, value, currency, userName, FundsRepository.getLatestCosts().name);
    };

    static showCostsHandler = async (bot, msg) => {
        const fundName = FundsRepository.getLatestCosts()?.name;

        if (!fundName) {
            bot.sendMessage(msg.chat.id, t("funds.showcosts.fail"));
            return;
        }

        return this.fundHandler(bot, msg, fundName);
    };

    static showCostsDonutHandler = async (bot, msg) => {
        let fundName = FundsRepository.getLatestCosts().name;

        return this.exportDonutHandler(bot, msg, fundName);
    };

    static removeDonationHandler = async (bot, msg, donationId) => {
        if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

        const success = FundsRepository.removeDonationById(donationId);

        await bot.sendMessage(
            msg.chat.id,
            success ? t("funds.removedonation.success", { donationId }) : t("funds.removedonation.fail")
        );
    };

    static changeDonationHandler = async (bot, msg, donationId, value, currency) => {
        if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

        value = parseMoneyValue(value);
        currency = await prepareCurrency(currency);

        const success = FundsRepository.updateDonation(donationId, value, currency);

        await bot.sendMessage(
            msg.chat.id,
            success ? t("funds.changedonation.success", { donationId }) : t("funds.changedonation.fail")
        );
    };

    static exportCSVHandler = async (bot, msg, fundName) => {
        try {
            const csvBuffer = await ExportHelper.exportFundToCSV(fundName);

            if (!csvBuffer?.length) {
                bot.sendMessage(msg.chat.id, t("funds.export.empty"));
                return;
            }

            const fileOptions = {
                filename: `${fundName} donations.csv`,
                contentType: "text/csv",
            };

            await bot.sendDocument(msg.chat.id, csvBuffer, {}, fileOptions);
        } catch (error) {
            logger.error(error);
            await bot.sendMessage(msg.chat.id, t("funds.export.fail"));
        }
    };

    static exportDonutHandler = async (bot, msg, fundName) => {
        let imageBuffer;
        try {
            imageBuffer = await ExportHelper.exportFundToDonut(fundName);

            if (!imageBuffer?.length) {
                bot.sendMessage(msg.chat.id, t("funds.export.empty"));
                return;
            }

            await bot.sendPhoto(msg.chat.id, imageBuffer);
        } catch (error) {
            logger.error(error);
            await bot.sendMessage(msg.chat.id, t("funds.export.fail"));
        }
    };
}

module.exports = FundsHandlers;
