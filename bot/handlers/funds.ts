import { Message } from "node-telegram-bot-api";

import FundsRepository from "../../repositories/fundsRepository";
import UsersRepository from "../../repositories/usersRepository";
import * as ExportHelper from "../../services/export";
import t from "../../services/localization";
import logger from "../../services/logger";
import * as TextGenerators from "../../services/textGenerators";
import * as UsersHelper from "../../services/usersHelper";
import { parseMoneyValue, prepareCurrency } from "../../utils/currency";
import { isMessageFromPrivateChat } from "../bot-helpers";
import HackerEmbassyBot from "../HackerEmbassyBot";

const CALLBACK_DATA_RESTRICTION = 23;

export default class FundsHandlers {
    static async fundsHandler(bot: HackerEmbassyBot, msg: Message) {
        const funds = FundsRepository.getFunds().filter(p => p.status === "open");
        const donations = FundsRepository.getDonations();
        const showAdmin =
            UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
            (isMessageFromPrivateChat(msg) || bot.context(msg).isAdminMode());

        const list = await TextGenerators.createFundList(funds, donations, { showAdmin }, bot.context(msg).mode);

        await bot.sendLongMessage(msg.chat.id, t("funds.funds", { list }), msg);
    }

    static async fundHandler(bot: HackerEmbassyBot, msg: Message, fundName: string) {
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
                                  opt: [fundName],
                              }),
                          },
                          {
                              text: t("funds.fund.buttons.donut"),
                              callback_data: JSON.stringify({
                                  command: "/ed",
                                  opt: [fundName],
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

    static async fundsallHandler(bot: HackerEmbassyBot, msg: Message) {
        const funds = FundsRepository.getFunds();
        const donations = FundsRepository.getDonations();
        const showAdmin =
            UsersHelper.hasRole(msg.from.username, "admin", "accountant") &&
            (isMessageFromPrivateChat(msg) || bot.context(msg).isAdminMode());

        const list = await TextGenerators.createFundList(funds, donations, { showAdmin, isHistory: true }, bot.context(msg).mode);

        await bot.sendLongMessage(msg.chat.id, t("funds.fundsall", { list }), msg);
    }

    static async addFundHandler(bot: HackerEmbassyBot, msg: Message, fundName: string, target: string, currency: string) {
        const targetValue = parseMoneyValue(target);
        currency = await prepareCurrency(currency);

        const success = !isNaN(targetValue) && FundsRepository.addFund(fundName, targetValue, currency);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.addfund.success", { fundName, targetValue, currency }) : t("funds.addfund.fail"),
            msg
        );
    }

    static async updateFundHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        fundName: string,
        target: string,
        currency: string,
        newFund: string
    ) {
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

    static async removeFundHandler(bot: HackerEmbassyBot, msg: Message, fundName: string) {
        const success = FundsRepository.removeFund(fundName);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.removefund.success", { fundName }) : t("funds.removefund.fail"),
            msg
        );
    }

    static async closeFundHandler(bot: HackerEmbassyBot, msg: Message, fundName: string) {
        const success = FundsRepository.closeFund(fundName);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.closefund.success", { fundName }) : t("funds.closefund.fail"),
            msg
        );
    }

    static async changeFundStatusHandler(bot: HackerEmbassyBot, msg: Message, fundName: string, fundStatus: string) {
        fundStatus = fundStatus.toLowerCase();

        const success = FundsRepository.changeFundStatus(fundName, fundStatus);

        bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.changestatus.success", { fundName, fundStatus }) : t("funds.changestatus.fail"),
            msg
        );
    }

    static async transferDonationHandler(bot: HackerEmbassyBot, msg: Message, id: number, accountant: string) {
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

    static async addDonationHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        valueString: string,
        currency: string,
        userName: string,
        fundName: string
    ) {
        const value = parseMoneyValue(valueString);
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

    static async costsHandler(bot: HackerEmbassyBot, msg: Message, valueString: string, currency: string, userName: string) {
        return FundsHandlers.addDonationHandler(bot, msg, valueString, currency, userName, FundsRepository.getLatestCosts().name);
    }

    static async showCostsHandler(bot: HackerEmbassyBot, msg: Message) {
        const fundName = FundsRepository.getLatestCosts()?.name;

        if (!fundName) {
            bot.sendMessageExt(msg.chat.id, t("funds.showcosts.fail"), msg);
            return;
        }

        return FundsHandlers.fundHandler(bot, msg, fundName);
    }

    static async showCostsDonutHandler(bot: HackerEmbassyBot, msg: Message) {
        const fundName = FundsRepository.getLatestCosts().name;

        return FundsHandlers.exportDonutHandler(bot, msg, fundName);
    }

    static async residentsDonatedHandler(bot: HackerEmbassyBot, msg: Message) {
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

    static async removeDonationHandler(bot: HackerEmbassyBot, msg: Message, donationId: number) {
        const success = FundsRepository.removeDonationById(donationId);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.removedonation.success", { donationId }) : t("funds.removedonation.fail"),
            msg
        );
    }

    static async changeDonationHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        donationId: number,
        valueString: string,
        currency: string
    ) {
        const value = parseMoneyValue(valueString);
        currency = await prepareCurrency(currency);

        const success = FundsRepository.updateDonation(donationId, value, currency);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.changedonation.success", { donationId }) : t("funds.changedonation.fail"),
            msg
        );
    }

    static async exportCSVHandler(bot: HackerEmbassyBot, msg: Message, fundName: string) {
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

    static async exportDonutHandler(bot: HackerEmbassyBot, msg: Message, fundName: string) {
        let imageBuffer: Buffer;

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
