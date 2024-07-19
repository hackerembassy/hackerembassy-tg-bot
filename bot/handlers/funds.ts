import { Message } from "node-telegram-bot-api";

import UsersRepository from "@repositories/users";
import FundsRepository, { COSTS_PREFIX } from "@repositories/funds";
import {
    convertCurrency,
    DefaultCurrency,
    initConvert,
    parseMoneyValue,
    prepareCurrency,
    sumDonations,
} from "@services/currency";
import * as ExportHelper from "@services/export";
import logger from "@services/logger";
import { getToday } from "@utils/date";
import { getImageFromPath } from "@utils/filesystem";

import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { AnnoyingInlineButton, ButtonFlags, InlineButton } from "../core/InlineButtons";
import t from "../core/localization";
import { RateLimiter } from "../core/RateLimit";
import { BotHandlers } from "../core/types";
import * as helpers from "../core/helpers";
import * as TextGenerators from "../textGenerators";
import EmbassyHandlers from "./embassy";

const CALLBACK_DATA_RESTRICTION = 21;

// Converter library needs time to initialize all currencies, so we need to init it in advance
initConvert();

export default class FundsHandlers implements BotHandlers {
    static async fundsHandler(bot: HackerEmbassyBot, msg: Message) {
        const context = bot.context(msg);
        const isAccountant = context.user.roles?.includes("accountant");
        const funds = FundsRepository.getAllFunds().filter(p => p.status === "open");
        const donations = FundsRepository.getAllDonations(true, true);
        const showAdmin = isAccountant && (context.isPrivate() || context.isAdminMode());

        const list = await TextGenerators.createFundList(funds, donations, { showAdmin }, context.mode);

        const inline_keyboard = [
            [
                AnnoyingInlineButton(bot, msg, t("basic.info.buttons.donate"), "donate"),
                AnnoyingInlineButton(bot, msg, t("general.buttons.menu"), "startpanel", ButtonFlags.Editing),
            ],
        ];

        await bot.sendLongMessage(msg.chat.id, t("funds.funds", { list }), msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static async fundHandler(bot: HackerEmbassyBot, msg: Message, fundName: string) {
        const context = bot.context(msg);
        const isAccountant = context.user.roles?.includes("accountant");
        const fund = FundsRepository.getFundByName(fundName);

        if (!fund) return bot.sendMessageExt(msg.chat.id, t("funds.fund.nofund"), msg);

        const donations = FundsRepository.getDonationsForFundId(fund.id, true, true);
        const showAdmin = isAccountant && (context.isPrivate() || context.isAdminMode());

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

        return bot.sendMessageExt(msg.chat.id, t("funds.fund.text", { fundlist }), msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static async fundsallHandler(bot: HackerEmbassyBot, msg: Message) {
        const context = bot.context(msg);
        const isAccountant = context.user.roles?.includes("accountant");
        const funds = FundsRepository.getAllFunds();
        const donations = FundsRepository.getAllDonations();
        const showAdmin = isAccountant && (context.isPrivate() || context.isAdminMode());

        const list = await TextGenerators.createFundList(funds, donations, { showAdmin, isHistory: true }, context.mode);

        await bot.sendLongMessage(msg.chat.id, t("funds.fundsall", { list }), msg);
    }

    static async addFundHandler(bot: HackerEmbassyBot, msg: Message, fundName: string, target: string, currency: string) {
        const targetValue = parseMoneyValue(target);
        const preparedCurrency = await prepareCurrency(currency);

        const success =
            !isNaN(targetValue) &&
            preparedCurrency &&
            FundsRepository.addFund({
                name: fundName,
                target_value: targetValue,
                target_currency: preparedCurrency,
                status: "open",
            });

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

        const fund = FundsRepository.getFundByName(fundName);

        if (!fund) return bot.sendMessageExt(msg.chat.id, t("funds.updatefund.nofund"), msg);

        const success =
            !isNaN(targetValue) &&
            preparedCurrency &&
            FundsRepository.updateFund({
                ...fund,
                name: newFundName,
                target_value: targetValue,
                target_currency: preparedCurrency,
            });

        return bot.sendMessageExt(
            msg.chat.id,
            success
                ? t("funds.updatefund.success", { fundName, targetValue, currency: preparedCurrency })
                : t("funds.updatefund.fail"),
            msg
        );
    }

    static async removeFundHandler(bot: HackerEmbassyBot, msg: Message, fundName: string) {
        const success = FundsRepository.removeFundByName(fundName);

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

    static transferDonationHandler(bot: HackerEmbassyBot, msg: Message, id: number, accountantName: string) {
        const accountant = UsersRepository.getUserByName(accountantName.replace("@", ""));

        if (!accountant) return bot.sendMessageExt(msg.chat.id, t("funds.transferdonation.fail"), msg);

        const success = FundsRepository.transferDonation(id, accountant.userid);
        const donation = FundsRepository.getDonationById(id, false, true);

        let text = t("funds.transferdonation.fail");

        if (success && donation) {
            const fund = FundsRepository.getFundById(donation.fund_id);
            text = t("funds.transferdonation.success", {
                id,
                accountant: helpers.userLink(accountant),
                username: helpers.userLink(donation.user),
                fund,
                donation,
            });
        }

        return bot.sendMessageExt(msg.chat.id, text, msg);
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
        const user = UsersRepository.getUserByName(userName.replace("@", ""));
        const accountant = bot.context(msg).user;

        if (!user) return bot.sendMessageExt(msg.chat.id, t("general.nouser"), msg);

        const fund = FundsRepository.getFundByName(fundName);

        if (!fund) return bot.sendMessageExt(msg.chat.id, t("funds.adddonation.nofund"), msg);

        const existingUserDonations = FundsRepository.getDonationsForName(fundName).filter(
            donation => donation.user_id === user.userid
        );
        const hasAlreadyDonated = existingUserDonations.length > 0;

        const success =
            !isNaN(value) &&
            preparedCurrency &&
            FundsRepository.addDonationTo(fund.id, user.userid, value, preparedCurrency, accountant.userid);
        const text = success
            ? t(hasAlreadyDonated ? "funds.adddonation.increased" : "funds.adddonation.success", {
                  username: helpers.formatUsername(userName, bot.context(msg).mode),
                  value,
                  currency: preparedCurrency,
                  fundName,
              })
            : t("funds.adddonation.fail");

        try {
            if (!success) throw new Error("Failed to add donation");

            const valueInDefaultCurrency = await convertCurrency(value, preparedCurrency, DefaultCurrency);

            if (!valueInDefaultCurrency) throw new Error("Failed to convert currency");

            let animeImage: Nullable<Buffer> = null;

            if (value === 42069 || value === 69420 || value === 69 || value === 420) {
                animeImage = await getImageFromPath(`./resources/images/memes/comedy.jpg`);
            } else {
                const happinessLevel =
                    valueInDefaultCurrency < 10000
                        ? 1
                        : valueInDefaultCurrency < 20000
                          ? 2
                          : valueInDefaultCurrency < 40000
                            ? 3
                            : valueInDefaultCurrency < 80000
                              ? 4
                              : 5; // lol
                animeImage = await getImageFromPath(`./resources/images/anime/${happinessLevel}.jpg`);
            }

            if (!animeImage) throw new Error("Failed to get image");

            await bot.sendPhotoExt(msg.chat.id, animeImage, msg, {
                caption: text,
            });

            bot.context(msg).mode.silent = true;

            return Promise.allSettled([
                EmbassyHandlers.sendDonationsSummaryHandler(bot, msg, fundName),
                EmbassyHandlers.playinspaceHandler(bot, msg, "money", true),
            ]);
        } catch (error) {
            logger.error(error);

            return bot.sendMessageExt(msg.chat.id, text, msg);
        }
    }

    static async costsHandler(bot: HackerEmbassyBot, msg: Message, valueString: string, currency: string, userName: string) {
        const isAccountant = bot.context(msg).user.roles?.includes("accountant");

        if (!isAccountant || !valueString || !userName) return FundsHandlers.showCostsHandler(bot, msg);

        const selectedCurrency = currency.length ? currency : DefaultCurrency;
        const latestCostsFund = FundsRepository.getLatestCosts();

        if (!latestCostsFund) return bot.sendMessageExt(msg.chat.id, t("funds.showcosts.fail"), msg);

        return await FundsHandlers.addDonationHandler(bot, msg, valueString, selectedCurrency, userName, latestCostsFund.name);
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

    static async residentsDonatedHandler(bot: HackerEmbassyBot, msg: Message, option: "all" | "paid" | "left" = "all") {
        const fundName = FundsRepository.getLatestCosts()?.name;

        if (!fundName) {
            bot.sendMessageExt(msg.chat.id, t("funds.showcosts.fail"), msg);
            return;
        }

        let resdientsDonatedList = `${t("funds.residentsdonated")}\n`;

        const donations = FundsRepository.getDonationsForName(fundName);
        const residents = UsersRepository.getUsersByRole("member");

        if (residents.length > 0 && donations.length > 0) {
            for (const resident of residents) {
                const hasDonated = donations.filter(d => d.user_id === resident.userid).length > 0;
                const shouldInclude = option === "all" || (option === "paid" && hasDonated) || (option === "left" && !hasDonated);

                if (!shouldInclude) continue;

                resdientsDonatedList += `${hasDonated ? "✅" : "⛔"} ${helpers.formatUsername(
                    resident.username,
                    bot.context(msg).mode
                )}\n`;
            }
        }

        await bot.sendMessageExt(msg.chat.id, resdientsDonatedList, msg);
    }

    static async resdientsHistoryHandler(bot: HackerEmbassyBot, msg: Message, year: number = getToday().getFullYear()) {
        const donations = FundsRepository.getCostsFundDonations(year);
        const residentIds = UsersRepository.getUsersByRole("member").map(u => u.userid);

        if (residentIds.length !== 0 && donations.length > 0) {
            const residentsDonations = donations.filter(d => residentIds.includes(d.user_id));

            const filteredDonations = ExportHelper.prepareCostsForExport(residentsDonations, COSTS_PREFIX);
            const imageBuffer = await ExportHelper.exportDonationsToLineChart(filteredDonations, `${COSTS_PREFIX} ${year}`);

            if (imageBuffer.length !== 0) return await bot.sendPhotoExt(msg.chat.id, imageBuffer, msg);

            return await bot.sendMessageExt(msg.chat.id, t("funds.residentshistory.fail"), msg);
        }

        return await bot.sendMessageExt(msg.chat.id, t("funds.residentshistory.empty"), msg);
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
        const donation = FundsRepository.getDonationById(donationId);

        if (!donation) return bot.sendMessageExt(msg.chat.id, t("funds.changedonation.nodonation"), msg);

        const success =
            preparedCurrency &&
            FundsRepository.updateDonation({
                ...donation,
                value,
                currency: preparedCurrency,
            });

        return bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.changedonation.success", { donationId }) : t("funds.changedonation.fail"),
            msg
        );
    }

    static async debtHandler(bot: HackerEmbassyBot, msg: Message, username: Optional<string> = undefined) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const target = username ? UsersRepository.getUserByName(username.replace("@", "")) : bot.context(msg).user;

        if (!target) return bot.sendMessageExt(msg.chat.id, t("general.nouser"), msg);

        const donations = FundsRepository.getFundDonationsHeldBy(target.userid);
        const donationList = donations.length ? TextGenerators.generateFundDonationsList(donations, true) : "";
        const totalDonated = donations.length ? await sumDonations(donations) : 0;
        const formattedUsername = helpers.userLink(target);

        const message =
            donationList.length > 0
                ? t("funds.debt.text", {
                      donationList,
                      username: formattedUsername,
                      total: totalDonated.toFixed(2),
                      currency: DefaultCurrency,
                  })
                : t("funds.debt.empty");

        return bot.sendLongMessage(msg.chat.id, message, msg);
    }

    static transferAllToHandler(bot: HackerEmbassyBot, msg: Message, username: string, fundName?: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const sender = bot.context(msg).user;
        const fund = fundName ? FundsRepository.getFundByName(fundName) : undefined;
        const donations = FundsRepository.getFundDonationsHeldBy(sender.userid, fund?.id);

        if (donations.length === 0) return bot.sendMessageExt(msg.chat.id, t("funds.transferdonation.nothing"), msg);

        return RateLimiter.executeOverTime(
            donations.map(d => () => FundsHandlers.transferDonationHandler(bot, msg, d.id, username))
        );
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
