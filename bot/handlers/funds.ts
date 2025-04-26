import { Message } from "node-telegram-bot-api";

import config from "config";

import { BotConfig } from "@config";
import { User } from "@data/models";
import UsersRepository from "@repositories/users";
import FundsRepository, { COSTS_PREFIX } from "@repositories/funds";
import {
    convertCurrency,
    DefaultCurrency,
    initConvert,
    parseMoneyValue,
    prepareCurrency,
    sumDonations,
    toBasicMoneyString,
} from "@services/funds/currency";
import * as ExportHelper from "@services/funds/export";
import logger from "@services/common/logger";
import { userService } from "@services/domain/user";

import { getToday } from "@utils/date";
import { getImageFromPath } from "@utils/filesystem";
import { replaceUnsafeSymbolsForAscii } from "@utils/text";
import { Route } from "@hackembot/core/decorators";
import { Accountants, CaptureListOfIds, Members } from "@hackembot/core/constants";

import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { AnnoyingInlineButton, ButtonFlags, InlineButton } from "../core/InlineButtons";
import t from "../core/localization";
import { RateLimiter } from "../core/RateLimit";
import { BotHandlers } from "../core/types";
import * as helpers from "../core/helpers";
import * as TextGenerators from "../textGenerators";
import EmbassyHandlers from "./embassy";
import { OptionalParam } from "../core/helpers";

const botConfig = config.get<BotConfig>("bot");

const CALLBACK_DATA_RESTRICTION = 21;

// Converter library needs time to initialize all currencies, so we need to init it in advance
initConvert();

export default class FundsHandlers implements BotHandlers {
    @Route(["funds", "fs"])
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

    @Route(["fund", "f"], /(.*\S)/, match => [match[1]])
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
                ? [[InlineButton(t("funds.fund.buttons.donut"), "ed", undefined, { params: fundName })]]
                : [];

        const fundlist = await TextGenerators.createFundList([fund], donations, { showAdmin }, bot.context(msg).mode);

        return bot.sendMessageExt(msg.chat.id, t("funds.fund.text", { fundlist }), msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    @Route(["fundsall", "fundshistory", "fsa"])
    static async fundsallHandler(bot: HackerEmbassyBot, msg: Message) {
        const context = bot.context(msg);
        const isAccountant = context.user.roles?.includes("accountant");
        const funds = FundsRepository.getAllFunds();
        const donations = FundsRepository.getAllDonations();
        const showAdmin = isAccountant && (context.isPrivate() || context.isAdminMode());

        const list = await TextGenerators.createFundList(funds, donations, { showAdmin, isHistory: true }, context.mode);

        await bot.sendLongMessage(msg.chat.id, t("funds.fundsall", { list }), msg);
    }

    @Route(
        ["addfund"],
        /(.*\S) with target (\d+(?:\.\d+)?(?:k|тыс|тысяч|т)?)\s?(\D*)/,
        match => [match[1], match[2], match[3]],
        Accountants
    )
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
            success
                ? t("funds.addfund.success", {
                      fundName,
                      targetValue: toBasicMoneyString(targetValue),
                      currency: preparedCurrency,
                  })
                : t("funds.addfund.fail"),
            msg
        );
    }

    @Route(
        ["updatefund"],
        /(.*\S) with target (\d+(?:\.\d+)?(?:k|тыс|тысяч|т)?)\s?(\D*?)(?: as (.*\S))?/,
        match => [match[1], match[2], match[3], match[4]],
        Accountants
    )
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
                ? t("funds.updatefund.success", {
                      fundName,
                      targetValue: toBasicMoneyString(targetValue),
                      currency: preparedCurrency,
                  })
                : t("funds.updatefund.fail"),
            msg
        );
    }

    @Route(["removefund"], /(.*\S)/, match => [match[1]], Accountants)
    static async removeFundHandler(bot: HackerEmbassyBot, msg: Message, fundName: string) {
        const success = FundsRepository.removeFundByName(fundName);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.removefund.success", { fundName }) : t("funds.removefund.fail"),
            msg
        );
    }

    @Route(["closefund"], /(.*\S)/, match => [match[1]], Accountants)
    static async closeFundHandler(bot: HackerEmbassyBot, msg: Message, fundName: string) {
        const success = FundsRepository.closeFund(fundName);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.closefund.success", { fundName }) : t("funds.closefund.fail"),
            msg
        );
    }

    @Route(["changefundstatus"], /of (.*\S) to (.*\S)/, match => [match[1], match[2]], Accountants)
    static async changeFundStatusHandler(bot: HackerEmbassyBot, msg: Message, fundName: string, fundStatus: string) {
        fundStatus = fundStatus.toLowerCase();

        const success = FundsRepository.changeFundStatus(fundName, fundStatus);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.changestatus.success", { fundName, fundStatus }) : t("funds.changestatus.fail"),
            msg
        );
    }

    @Route(["transferdonation", "td"], /(\d[\d\s,]*?) to (.*\S)/, match => [match[1], match[2]], Accountants)
    @Route(["tosafe"], CaptureListOfIds, match => [match[1], "safe"], Accountants)
    @Route(["topaid", "paid", "tp"], CaptureListOfIds, match => [match[1], "paid"], Accountants)
    @Route(["tocab", "givecab", "tc"], CaptureListOfIds, match => [match[1], "CabiaRangris"], Accountants)
    @Route(["tonick", "givenick", "tn"], CaptureListOfIds, match => [match[1], "korn9509"], Accountants)
    static transferDonationHandler(bot: HackerEmbassyBot, msg: Message, donations: string, accountantName: string) {
        const accountant = UsersRepository.getUserByName(accountantName.replace("@", ""));

        if (!accountant) return bot.sendMessageExt(msg.chat.id, t("funds.transferdonation.fail"), msg);

        const donationIds = donations.replaceAll(/\s/g, "").split(",").map(Number);
        const messages = [];

        for (const donationId of donationIds) {
            const success = FundsRepository.transferDonation(donationId, accountant.userid);
            const donation = FundsRepository.getDonationById(donationId, true, true);
            const text =
                success && donation
                    ? t("funds.transferdonation.success", {
                          id: donationId,
                          accountant: helpers.userLink(accountant),
                          username: donation.user.username
                              ? helpers.formatUsername(donation.user.username)
                              : helpers.userLink(donation.user),
                          fund: donation.fund,
                          donation,
                      })
                    : t("funds.transferdonation.fail", { id: donations });

            messages.push(text);
        }

        return RateLimiter.executeOverTime(messages.map(m => () => bot.sendMessageExt(msg.chat.id, m, msg)));
    }

    @Route(["getsponsors", "sponsors"])
    static async sponsorsHandler(bot: HackerEmbassyBot, msg: Message) {
        const sponsors = UsersRepository.getSponsors();
        const sponsorsList = TextGenerators.getSponsorsList(sponsors);

        const inline_keyboard = [
            [
                AnnoyingInlineButton(bot, msg, t("basic.info.buttons.donate"), "donate", ButtonFlags.Editing),
                AnnoyingInlineButton(bot, msg, t("general.buttons.readmore"), "infopanel", ButtonFlags.Editing),
            ],
        ];

        await bot.sendOrEditMessage(
            msg.chat.id,
            t("funds.sponsors.list", { list: sponsorsList }),
            msg,
            { reply_markup: { inline_keyboard } },
            msg.message_id
        );
    }

    @Route(["refreshsponsors", "recalculatesponsors"], null, null, Accountants)
    static async refreshSponsorshipsHandler(bot: HackerEmbassyBot, msg?: Message) {
        try {
            const donations = FundsRepository.getAllDonations(false, true, ExportHelper.getSponsorshipStartPeriodDate());
            const sponsorDataMap = ExportHelper.getUserDonationMap(donations);

            for (const { user, donations } of sponsorDataMap) {
                const oldSponsorship = user.sponsorship;
                user.sponsorship = await ExportHelper.getSponsorshipLevel(donations);
                if (oldSponsorship !== user.sponsorship) {
                    userService.saveUser(user);
                    logger.info(`Updated sponsorship for ${user.username} from ${oldSponsorship} to ${user.sponsorship}`);
                }
            }

            if (msg) bot.sendMessageExt(msg.chat.id, t("funds.refreshsponsorships.success"), msg);
        } catch (error) {
            logger.error(error);

            if (msg) bot.sendMessageExt(msg.chat.id, t("funds.refreshsponsorships.fail"), msg);
        }
    }

    static async getAnimeImageForDonation(value: number, currency: string, user: User) {
        const valueInDefaultCurrency = await convertCurrency(value, currency, DefaultCurrency);

        if (!valueInDefaultCurrency) throw new Error("Failed to convert currency");

        if (value === 42069 || value === 69420 || value === 69 || value === 420) {
            return getImageFromPath(`./resources/images/memes/comedy.jpg`);
        } else if (value === 2040) {
            return getImageFromPath(`./resources/images/memes/2040.jpg`);
        } else if (value === 8266) {
            return getImageFromPath(`./resources/images/memes/8266.jpg`);
        } else if (user.username && botConfig.funds.alternativeUsernames.includes(user.username)) {
            return getImageFromPath(`./resources/images/anime/guy.jpg`);
        } else {
            const happinessLevel = value < 10000 ? 1 : value < 20000 ? 2 : value < 40000 ? 3 : value < 80000 ? 4 : 5; // lol
            return getImageFromPath(`./resources/images/anime/${happinessLevel}.jpg`);
        }
    }

    @Route(
        ["adddonation", "ad"],
        /(\d+(?:\.\d+)?(?:k|тыс|тысяч|т)?)\s?(\D*?) from (\S+?) to (.*\S)/,
        match => [match[1], match[2], match[3], match[4]],
        Accountants
    )
    static async addDonationHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        valueString: string,
        currency: string,
        sponsorName: string,
        fundName: string
    ) {
        try {
            // Prepare and validate input
            const value = parseMoneyValue(valueString);
            const preparedCurrency = await prepareCurrency(currency);
            if (isNaN(value) || !preparedCurrency) throw new Error("Invalid value or currency");

            const user =
                UsersRepository.getUserByName(sponsorName.replace("@", "")) ??
                UsersRepository.getUserByUserId(helpers.getMentions(msg)[0]?.id);
            const accountant = bot.context(msg).user;
            if (!user) return bot.sendMessageExt(msg.chat.id, t("general.nouser"), msg);

            const fund = FundsRepository.getFundByName(fundName);
            if (!fund) return bot.sendMessageExt(msg.chat.id, t("funds.adddonation.nofund"), msg);

            // Check if user has already donated to this fund
            const existingUserDonations = FundsRepository.getDonationsForName(fundName).filter(
                donation => donation.user_id === user.userid
            );
            const hasAlreadyDonated = existingUserDonations.length > 0;

            // Add donation to the fund
            const lastInsertRowid = FundsRepository.addDonationTo(
                fund.id,
                user.userid,
                value,
                accountant.userid,
                preparedCurrency
            );

            // Update user sponsorship level
            const userDonations = FundsRepository.getDonationsOf(
                user.userid,
                false,
                false,
                ExportHelper.getSponsorshipStartPeriodDate()
            );
            const sponsorship = await ExportHelper.getSponsorshipLevel(userDonations);
            const hasUpdatedSponsorship = user.sponsorship !== sponsorship;

            if (hasUpdatedSponsorship) {
                user.sponsorship = sponsorship;
                userService.saveUser(user);
            }

            // Send message to the chat
            const newDonationText = TextGenerators.getNewDonationText(
                user,
                value,
                preparedCurrency,
                lastInsertRowid,
                fundName,
                hasAlreadyDonated
            );
            const sponsorshipText = hasUpdatedSponsorship ? "\n" + TextGenerators.getNewSponsorshipText(user, sponsorship) : "";
            const caption = `${newDonationText}${sponsorshipText}`;
            const animeImage = await FundsHandlers.getAnimeImageForDonation(value, preparedCurrency, user);

            animeImage
                ? await bot.sendPhotoExt(msg.chat.id, animeImage, msg, { caption })
                : await bot.sendMessageExt(msg.chat.id, caption, msg);

            // Send notification to Space
            bot.context(msg).mode.silent = true;
            const textInSpace = replaceUnsafeSymbolsForAscii(newDonationText);

            return Promise.allSettled([
                EmbassyHandlers.textinspaceHandler(bot, msg, textInSpace),
                EmbassyHandlers.playinspaceHandler(bot, msg, "money", true),
            ]);
        } catch (error) {
            logger.error(error);

            return bot.sendMessageExt(msg.chat.id, t("funds.adddonation.fail"), msg);
        }
    }

    @Route(["costs", "cs", "rent"], OptionalParam(/(\d+(?:\.\d+)?(?:k|тыс|тысяч|т)?)\s?(\D*?) from (\S+?)(\s.*)?/), match => [
        match[1],
        match[2],
        match[3],
    ])
    static async costsHandler(bot: HackerEmbassyBot, msg: Message, valueString: string, currency: string, userName: string) {
        const isAccountant = bot.context(msg).user.roles?.includes("accountant");

        console.log("isAccountant", isAccountant);
        console.log("valueString", valueString);
        console.log("currency", currency);
        console.log("userName", userName);

        if (!isAccountant || !valueString || !userName) return FundsHandlers.showCostsHandler(bot, msg);

        const selectedCurrency = currency.length ? currency : DefaultCurrency;
        const latestCostsFund = FundsRepository.getLatestCosts();

        if (!latestCostsFund) return bot.sendMessageExt(msg.chat.id, t("funds.showcosts.fail"), msg);

        return await FundsHandlers.addDonationHandler(bot, msg, valueString, selectedCurrency, userName, latestCostsFund.name);
    }

    @Route(["showcosts", "scosts", "scs"])
    static async showCostsHandler(bot: HackerEmbassyBot, msg: Message) {
        const fundName = FundsRepository.getLatestCosts()?.name;

        if (!fundName) {
            bot.sendMessageExt(msg.chat.id, t("funds.showcosts.fail"), msg);
            return;
        }

        return await FundsHandlers.fundHandler(bot, msg, fundName);
    }

    @Route(["showcostsdonut", "costsdonut", "cdonut"])
    static async showCostsDonutHandler(bot: HackerEmbassyBot, msg: Message) {
        const latestCostsFund = FundsRepository.getLatestCosts();

        if (!latestCostsFund) return bot.sendMessageExt(msg.chat.id, t("funds.showcosts.fail"), msg);

        return await FundsHandlers.exportDonutHandler(bot, msg, latestCostsFund.name);
    }

    @Route(
        ["residentscosts", "residentsdonated", "residentcosts", "rcosts"],
        OptionalParam(/(all|paid|left)/),
        match => [match[1]],
        Members
    )
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
                    bot.context(msg).mode.mention
                )}\n`;
            }
        }

        await bot.sendMessageExt(msg.chat.id, resdientsDonatedList, msg);
    }

    @Route(
        ["residentscostshistory", "historycosts", "rhcosts", "rhcs"],
        OptionalParam(/(\d\d\d\d)/),
        match => [match[1]],
        Members
    )
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

    @Route(["removedonation"], /(\d+)/, match => [match[1]], Accountants)
    static async removeDonationHandler(bot: HackerEmbassyBot, msg: Message, donationId: number) {
        const success = FundsRepository.removeDonationById(donationId);

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("funds.removedonation.success", { donationId }) : t("funds.removedonation.fail"),
            msg
        );
    }

    @Route(["changedonation"], /(\d+) to (\S+)\s?(\D*?)/, match => [match[1], match[2], match[3]], Accountants)
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

    @Route(["debt", "mymoney"], OptionalParam(/(\S+)/), match => [match[1]], Accountants)
    static async debtHandler(bot: HackerEmbassyBot, msg: Message, username?: string) {
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

    @Route(["tosafeall"], helpers.OptionalParam(/(.*)/), match => ["safe", match[1]], Accountants)
    @Route(["topaidall", "paidall"], helpers.OptionalParam(/(.*)/), match => ["paid", match[1]], Accountants)
    @Route(
        ["tocaball", "givecaball", "givecaballmymoney", "tca"],
        OptionalParam(/(.*)/),
        match => ["CabiaRangris", match[1]],
        Accountants
    )
    static transferAllToHandler(bot: HackerEmbassyBot, msg: Message, username: string, fundName?: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const sender = bot.context(msg).user;
        const fund = fundName ? FundsRepository.getFundByName(fundName) : undefined;
        const donations = FundsRepository.getFundDonationsHeldBy(sender.userid, fund?.id);

        if (donations.length === 0) return bot.sendMessageExt(msg.chat.id, t("funds.transferdonation.nothing"), msg);

        return FundsHandlers.transferDonationHandler(bot, msg, donations.map(d => d.id).join(","), username);
    }

    @Route(["exportfund", "csv", "ef"], /(.*\S)/, match => [match[1]])
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

    @Route(["exportdonut", "donut", "ed"], /(.*\S)/, match => [match[1]])
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
