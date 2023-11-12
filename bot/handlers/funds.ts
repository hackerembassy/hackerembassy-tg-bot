import { Message } from "node-telegram-bot-api";

import FundsRepository from "../../repositories/fundsRepository";
import UsersRepository from "../../repositories/usersRepository";
import * as ExportHelper from "../../services/export";
import t from "../../services/localization";
import logger from "../../services/logger";
import * as TextGenerators from "../../services/textGenerators";
import { initConvert, parseMoneyValue, prepareCurrency, sumDonations } from "../../utils/currency";
import { equalsIns } from "../../utils/text";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { BotHandlers } from "../core/types";
import * as helpers from "../helpers";
import { InlineButton, isPrivateMessage } from "../helpers";

const CALLBACK_DATA_RESTRICTION = 21;

// Converter library needs time to initialize all currencies, so we need to init it in advance
initConvert();

export default class FundsHandlers implements BotHandlers {
    static async fundsHandler(bot: HackerEmbassyBot, msg: Message) {
        const funds = FundsRepository.getFunds()?.filter(p => p.status === "open");
        const donations = FundsRepository.getDonations();
        const showAdmin =
            helpers.hasRole(msg.from?.username, "admin", "accountant") &&
            (isPrivateMessage(msg, bot.context(msg)) || bot.context(msg).isAdminMode());

        const list = await TextGenerators.createFundList(funds, donations, { showAdmin }, bot.context(msg).mode);

        await bot.sendLongMessage(msg.chat.id, t("funds.funds", { list }), msg);
    }

    static async fundHandler(bot: HackerEmbassyBot, msg: Message, fundName: string) {
        const fund = FundsRepository.getFundByName(fundName);

        if (!fund) {
            await bot.sendMessageExt(msg.chat.id, t("funds.fund.nofund"), msg);
            return;
        }

        const donations = FundsRepository.getDonationsForName(fundName);
        const showAdmin =
            helpers.hasRole(msg.from?.username, "admin", "accountant") &&
            (isPrivateMessage(msg, bot.context(msg)) || bot.context(msg).isAdminMode());

        // telegram callback_data is restricted to 64 bytes
        const inline_keyboard =
            fundName.length < CALLBACK_DATA_RESTRICTION
                ? [
                      [
                          InlineButton(t("funds.fund.buttons.csv"), "ef", undefined, { params: fundName }),
                          InlineButton(t("funds.fund.buttons.donut"), "ed", undefined, { params: fundName }),
                      ],
                  ]
                : [];

        const fundlist = await TextGenerators.createFundList([fund], donations, { showAdmin }, bot.context(msg).mode);

        await bot.sendMessageExt(msg.chat.id, t("funds.fund.text", { fundlist }), msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static async fundsallHandler(bot: HackerEmbassyBot, msg: Message) {
        const context = bot.context(msg);
        const funds = FundsRepository.getFunds();
        const donations = FundsRepository.getDonations();
        const showAdmin =
            helpers.hasRole(msg.from?.username, "admin", "accountant") &&
            (isPrivateMessage(msg, context) || bot.context(msg).isAdminMode());

        const list = await TextGenerators.createFundList(funds, donations, { showAdmin, isHistory: true }, context.mode);

        await bot.sendLongMessage(msg.chat.id, t("funds.fundsall", { list }), msg);
    }

    static async addFundHandler(bot: HackerEmbassyBot, msg: Message, fundName: string, target: string, currency: string) {
        const targetValue = parseMoneyValue(target);
        const preparedCurrency = await prepareCurrency(currency);

        const success =
            !isNaN(targetValue) && preparedCurrency && FundsRepository.addFund(fundName, targetValue, preparedCurrency);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.addfund.success", { fundName, targetValue, currency: preparedCurrency }) : t("funds.addfund.fail"),
            msg
        );
    }

    static async updateFundHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        fundName: string,
        target: string,
        currency: string,
        newFund?: string
    ) {
        const targetValue = parseMoneyValue(target);
        const preparedCurrency = await prepareCurrency(currency);
        const newFundName = newFund && newFund.length > 0 ? newFund : fundName;

        const success =
            !isNaN(targetValue) &&
            preparedCurrency &&
            FundsRepository.updateFund(fundName, targetValue, preparedCurrency, newFundName);

        await bot.sendMessageExt(
            msg.chat.id,
            success
                ? t("funds.updatefund.success", { fundName, targetValue, currency: preparedCurrency })
                : t("funds.updatefund.fail"),
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

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.changestatus.success", { fundName, fundStatus }) : t("funds.changestatus.fail"),
            msg
        );
    }

    static async transferDonationHandler(bot: HackerEmbassyBot, msg: Message, id: number, accountant: string) {
        accountant = accountant.replace("@", "");

        const success = FundsRepository.transferDonation(id, accountant);
        const donation = FundsRepository.getDonationById(id);

        let text = t("funds.transferdonation.fail");

        if (success && donation) {
            const fund = FundsRepository.getFundById(donation.fund_id);
            text = t("funds.transferdonation.success", {
                id,
                accountant: helpers.formatUsername(accountant, bot.context(msg).mode),
                username: helpers.formatUsername(donation.username, bot.context(msg).mode),
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
        const preparedCurrency = await prepareCurrency(currency);
        userName = userName.replace("@", "");
        const accountant = msg.from?.username;

        const userDonations = FundsRepository.getDonationsForName(fundName)?.filter(donation =>
            equalsIns(donation.username, userName)
        );
        const hasAlreadyDonated = userDonations && userDonations.length > 0;

        const success =
            !isNaN(value) &&
            preparedCurrency &&
            FundsRepository.addDonationTo(fundName, userName, value, preparedCurrency, accountant);
        const text = success
            ? t(hasAlreadyDonated ? "funds.adddonation.increased" : "funds.adddonation.success", {
                  username: helpers.formatUsername(userName, bot.context(msg).mode),
                  value,
                  currency: preparedCurrency,
                  fundName,
              })
            : t("funds.adddonation.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static async costsHandler(bot: HackerEmbassyBot, msg: Message, valueString: string, currency: string, userName: string) {
        const latestCostsFund = FundsRepository.getLatestCosts();

        if (!latestCostsFund) return bot.sendMessageExt(msg.chat.id, t("funds.showcosts.fail"), msg);

        return await FundsHandlers.addDonationHandler(bot, msg, valueString, currency, userName, latestCostsFund.name);
    }

    static async showCostsHandler(bot: HackerEmbassyBot, msg: Message) {
        const fundName = FundsRepository.getLatestCosts()?.name;

        if (!fundName) {
            bot.sendMessageExt(msg.chat.id, t("funds.showcosts.fail"), msg);
            return;
        }

        return await FundsHandlers.fundHandler(bot, msg, fundName);
    }

    static async showCostsDonutHandler(bot: HackerEmbassyBot, msg: Message) {
        const latestCostsFund = FundsRepository.getLatestCosts();

        if (!latestCostsFund) return bot.sendMessageExt(msg.chat.id, t("funds.showcosts.fail"), msg);

        return await FundsHandlers.exportDonutHandler(bot, msg, latestCostsFund.name);
    }

    static async residentsDonatedHandler(bot: HackerEmbassyBot, msg: Message) {
        const fundName = FundsRepository.getLatestCosts()?.name;

        if (!fundName) {
            bot.sendMessageExt(msg.chat.id, t("funds.showcosts.fail"), msg);
            return;
        }

        let resdientsDonatedList = `${t("funds.residentsdonated")}\n`;

        const donations = FundsRepository.getDonationsForName(fundName);
        const residents = UsersRepository.getUsers()?.filter(u => helpers.hasRole(u.username, "member"));

        if (residents && donations) {
            for (const resident of residents) {
                const hasDonated = donations.filter(d => equalsIns(d.username, resident.username)).length > 0;
                resdientsDonatedList += `${hasDonated ? "✅" : "⛔"} ${helpers.formatUsername(resident.username)}\n`;
            }
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
        const preparedCurrency = await prepareCurrency(currency);

        const success = preparedCurrency && FundsRepository.updateDonationValues(donationId, value, preparedCurrency);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.changedonation.success", { donationId }) : t("funds.changedonation.fail"),
            msg
        );
    }

    static async debtHandler(bot: HackerEmbassyBot, msg: Message, username: Optional<string> = undefined) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const selectedUsername = (username ?? msg.from?.username)?.replace("@", "");
        const donations = selectedUsername ? FundsRepository.getFundDonationsHeldBy(selectedUsername) : [];
        const donationList = donations ? TextGenerators.generateFundDonationsList(donations, true) : "";
        const totalDonated = donations ? await sumDonations(donations) : 0;
        const formattedUsername = helpers.formatUsername(selectedUsername, bot.context(msg).mode);

        const message =
            donationList.length > 0
                ? t("funds.debt.text", { donationList, username: formattedUsername, total: totalDonated, currency: "AMD" })
                : t("funds.debt.empty");

        await bot.sendLongMessage(msg.chat.id, message, msg);
    }

    static async transferAllToHandler(bot: HackerEmbassyBot, msg: Message, username: string, fundName?: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const selectedUsername = msg.from?.username?.replace("@", "");
        const donations = selectedUsername ? FundsRepository.getFundDonationsHeldBy(selectedUsername, fundName) : [];

        if (!donations || donations.length === 0) {
            await bot.sendMessageExt(msg.chat.id, t("funds.transferdonation.nothing"), msg);
            return;
        }

        for (const donation of donations) {
            await FundsHandlers.transferDonationHandler(bot, msg, donation.id, username);
        }
    }

    static async exportCSVHandler(bot: HackerEmbassyBot, msg: Message, fundName: string) {
        try {
            const csvBuffer = await ExportHelper.exportFundToCSV(fundName);

            if (csvBuffer.length === 0) {
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

            if (imageBuffer.length === 0) {
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
