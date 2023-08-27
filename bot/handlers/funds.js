const FundsRepository = require("../../repositories/fundsRepository");
const UsersRepository = require("../../repositories/usersRepository");
const { isMessageFromPrivateChat } = require("../bot-helpers");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const ExportHelper = require("../../services/export");
const { prepareCurrency, parseMoneyValue } = require("../../utils/currency");
const logger = require("../../services/logger");
const t = require("../../services/localization");

const CALLBACK_DATA_RESTRICTION = 20;

/**
 * @typedef {import("../HackerEmbassyBot").HackerEmbassyBot} HackerEmbassyBot
 * @typedef {import("node-telegram-bot-api").Message} Message
 */

class FundsHandlers {
    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async fundsHandler(bot, msg) {
        const funds = FundsRepository.getFunds().filter(p => p.status === "open");
        const donations = FundsRepository.getDonations();
        const showAdmin =
            UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
            (isMessageFromPrivateChat(msg) || bot.context(msg).isAdminMode());

        const list = await TextGenerators.createFundList(funds, donations, { showAdmin }, bot.context(msg).mode);

        await bot.sendLongMessage(msg.chat.id, t("funds.funds", { list }), msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async fundHandler(bot, msg, fundName) {
        const funds = [FundsRepository.getFundByName(fundName)];
        const donations = FundsRepository.getDonationsForName(fundName);
        const showAdmin =
            UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
            (isMessageFromPrivateChat(msg) || bot.context(msg).isAdminMode());

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

        const fundlist = await TextGenerators.createFundList(funds, donations, { showAdmin }, bot.context(msg).mode);

        await bot.sendMessageExt(msg.chat.id, t("funds.fund.text", { fundlist }), msg, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async fundsallHandler(bot, msg) {
        const funds = FundsRepository.getFunds();
        const donations = FundsRepository.getDonations();
        const showAdmin =
            UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
            (isMessageFromPrivateChat(msg) || bot.context(msg).isAdminMode());

        const list = await TextGenerators.createFundList(funds, donations, { showAdmin, isHistory: true }, bot.context(msg).mode);

        await bot.sendLongMessage(msg.chat.id, t("funds.fundsall", { list }), msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async addFundHandler(bot, msg, fundName, target, currency) {
        const targetValue = parseMoneyValue(target);
        currency = await prepareCurrency(currency);

        const success = !isNaN(targetValue) && FundsRepository.addFund(fundName, targetValue, currency);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.addfund.success", { fundName, targetValue, currency }) : t("funds.addfund.fail"),
            msg
        );
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async updateFundHandler(bot, msg, fundName, target, currency, newFund) {
        const targetValue = parseMoneyValue(target);
        currency = await prepareCurrency(currency);
        const newFundName = newFund?.length > 0 ? newFund : fundName;

        const success = !isNaN(targetValue) && FundsRepository.updateFund(fundName, targetValue, currency, newFundName);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.updatefund.success", { fundName, targetValue, currency }) : t("funds.updatefund.fail"),
            msg
        );
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async removeFundHandler(bot, msg, fundName) {
        const success = FundsRepository.removeFund(fundName);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.removefund.success", { fundName }) : t("funds.removefund.fail"),
            msg
        );
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async closeFundHandler(bot, msg, fundName) {
        const success = FundsRepository.closeFund(fundName);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.closefund.success", { fundName }) : t("funds.closefund.fail"),
            msg
        );
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async changeFundStatusHandler(bot, msg, fundName, fundStatus) {
        fundStatus = fundStatus.toLowerCase();

        const success = FundsRepository.changeFundStatus(fundName, fundStatus);

        bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.changestatus.success", { fundName, fundStatus }) : t("funds.changestatus.fail"),
            msg
        );
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async transferDonationHandler(bot, msg, id, accountant) {
        accountant = accountant.replace("@", "");

        const success = FundsRepository.transferDonation(id, accountant);
        let text = t("funds.transferdonation.fail");

        if (success) {
            const donation = FundsRepository.getDonationById(id);
            const fund = FundsRepository.getFundById(donation.fund_id);
            text = t("funds.transferdonation.success", {
                id,
                accountant: UsersHelper.formatUsername(accountant, bot.context(msg).mode),
                username: UsersHelper.formatUsername(donation.username, bot.context(msg).mode),
                fund,
                donation,
            });
        }

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async addDonationHandler(bot, msg, value, currency, userName, fundName) {
        value = parseMoneyValue(value);
        currency = await prepareCurrency(currency);
        userName = userName.replace("@", "");
        const accountant = msg.from.username;

        const hasAlreadyDonated =
            FundsRepository.getDonationsForName(fundName)?.filter(donation => donation.username === userName)?.length > 0;

        const success = !isNaN(value) && FundsRepository.addDonationTo(fundName, userName, value, currency, accountant);
        const text = success
            ? t(hasAlreadyDonated ? "funds.adddonation.increased" : "funds.adddonation.success", {
                  username: UsersHelper.formatUsername(userName, bot.context(msg).mode),
                  value,
                  currency,
                  fundName,
              })
            : t("funds.adddonation.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async costsHandler(bot, msg, value, currency, userName) {
        return this.addDonationHandler(bot, msg, value, currency, userName, FundsRepository.getLatestCosts().name);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async showCostsHandler(bot, msg) {
        const fundName = FundsRepository.getLatestCosts()?.name;

        if (!fundName) {
            bot.sendMessageExt(msg.chat.id, t("funds.showcosts.fail"), msg);
            return;
        }

        return this.fundHandler(bot, msg, fundName);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async showCostsDonutHandler(bot, msg) {
        let fundName = FundsRepository.getLatestCosts().name;

        return this.exportDonutHandler(bot, msg, fundName);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async residentsDonatedHandler(bot, msg) {
        const fundName = FundsRepository.getLatestCosts()?.name;

        if (!fundName) {
            bot.sendMessageExt(msg.chat.id, t("funds.showcosts.fail"), msg);
            return;
        }

        const donations = FundsRepository.getDonationsForName(fundName);
        const residents = UsersRepository.getUsers().filter(u => UsersHelper.hasRole(u.username, "member"));

        let resdientsDonatedList = `${t("funds.residentsdonated")}\n`;
        for (const resident of residents) {
            const hasDonated = donations.filter(d => d.username === resident.username)?.length > 0;
            resdientsDonatedList += `${hasDonated ? "✅" : "⛔"} ${UsersHelper.formatUsername(resident.username)}\n`;
        }

        await bot.sendMessageExt(msg.chat.id, resdientsDonatedList, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async removeDonationHandler(bot, msg, donationId) {
        const success = FundsRepository.removeDonationById(donationId);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.removedonation.success", { donationId }) : t("funds.removedonation.fail"),
            msg
        );
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async changeDonationHandler(bot, msg, donationId, value, currency) {
        value = parseMoneyValue(value);
        currency = await prepareCurrency(currency);

        const success = FundsRepository.updateDonation(donationId, value, currency);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.changedonation.success", { donationId }) : t("funds.changedonation.fail"),
            msg
        );
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async exportCSVHandler(bot, msg, fundName) {
        try {
            const csvBuffer = await ExportHelper.exportFundToCSV(fundName);

            if (!csvBuffer?.length) {
                bot.sendMessageExt(msg.chat.id, t("funds.export.empty"), msg);
                return;
            }

            const fileOptions = {
                filename: `${fundName} donations.csv`,
                contentType: "text/csv",
            };

            await bot.sendDocument(msg.chat.id, csvBuffer, {}, fileOptions);
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("funds.export.fail"), msg);
        }
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async exportDonutHandler(bot, msg, fundName) {
        let imageBuffer;
        try {
            imageBuffer = await ExportHelper.exportFundToDonut(fundName);

            if (!imageBuffer?.length) {
                bot.sendMessageExt(msg.chat.id, t("funds.export.empty"), msg);
                return;
            }

            await bot.sendPhotoExt(msg.chat.id, imageBuffer, msg);
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("funds.export.fail"), msg);
        }
    }
}

module.exports = FundsHandlers;
