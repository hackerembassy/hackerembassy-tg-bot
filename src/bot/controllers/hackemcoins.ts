import { Message } from "node-telegram-bot-api";

import { User } from "@data/models";
import { hasRole, userService } from "@services/domain/user";
import { DonationRewardEvent, HackemcoinOperationResult, hackemcoinsService } from "@services/domain/hackemcoins";
import { fundsService } from "@services/domain/funds";
import { FeatureFlag, Members, Route, UserRoles } from "@hackembot/core/decorators";

import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import t from "../core/localization";
import { BotController } from "../core/types";
import * as helpers from "../core/helpers";
import * as TextGenerators from "../text";

type BalanceChange = "grant" | "deduct";

interface BalanceChangeOperation {
    apply: (target: User, actor: User, amount: number, reason: string) => HackemcoinOperationResult;
    notification?: string;
}

const CaptureBalanceChange = (preposition: string) =>
    helpers.OptionalParam(new RegExp(`(\\d+) ${preposition} (\\S+) for ([\\s\\S]*\\S)`));

export default class HackemcoinsController implements BotController {
    private static readonly balanceChanges: Record<BalanceChange, BalanceChangeOperation> = {
        grant: {
            apply: (...args) => hackemcoinsService.grant(...args),
            notification: "hackemcoins.received.grant",
        },
        deduct: {
            apply: (...args) => hackemcoinsService.deduct(...args),
        },
    };

    @Route(["hackemcoins", "hackemcoin", "hc"], helpers.OptionalParam(/(\S+)/), match => [match[1]])
    @FeatureFlag("hackemcoins")
    static hackemcoinsHandler(bot: HackerEmbassyBot, msg: Message, username?: string) {
        const sender = bot.context(msg).user;

        if (!username) {
            return bot.sendMessageExt(
                msg.chat.id,
                t("hackemcoins.balance.text", {
                    balance: hackemcoinsService.getBalance(sender.userid),
                    rate: hackemcoinsService.rate,
                    currency: hackemcoinsService.currency,
                    percent: hackemcoinsService.donationRewardPercent,
                }),
                msg
            );
        }

        if (!hasRole(sender, "admin", ...Members)) return bot.sendRestrictedMessage(msg, { userRoles: Members });

        const target = helpers.resolveTargetUser(msg, username);

        if (!target) return bot.sendMessageExt(msg.chat.id, t("general.errors.nouser"), msg);

        return bot.sendMessageExt(
            msg.chat.id,
            t("hackemcoins.balance.of", {
                username: helpers.userLink(target),
                balance: hackemcoinsService.getBalance(target.userid),
            }),
            msg
        );
    }

    @Route(["hchistory", "hackemcoinshistory"])
    @FeatureFlag("hackemcoins")
    static historyHandler(bot: HackerEmbassyBot, msg: Message) {
        const user = bot.context(msg).user;
        const history = hackemcoinsService.getHistory(user.userid);

        return bot.sendMessageExt(
            msg.chat.id,
            TextGenerators.getHackemcoinHistory(history, hackemcoinsService.getBalance(user.userid)),
            msg
        );
    }

    @Route(["granthc"], CaptureBalanceChange("to"), match => [match[1], match[2], match[3]])
    @UserRoles(Members)
    @FeatureFlag("hackemcoins")
    static grantHandler(bot: HackerEmbassyBot, msg: Message, amount?: string, username?: string, reason?: string) {
        return HackemcoinsController.changeBalance(bot, msg, "grant", amount, username, reason);
    }

    @Route(["deducthc"], CaptureBalanceChange("from"), match => [match[1], match[2], match[3]])
    @UserRoles(Members)
    @FeatureFlag("hackemcoins")
    static deductHandler(bot: HackerEmbassyBot, msg: Message, amount?: string, username?: string, reason?: string) {
        return HackemcoinsController.changeBalance(bot, msg, "deduct", amount, username, reason);
    }

    static async changeBalance(
        bot: HackerEmbassyBot,
        msg: Message,
        change: BalanceChange,
        amountString?: string,
        username?: string,
        reason?: string
    ) {
        if (!amountString || !username || !reason) return bot.sendMessageExt(msg.chat.id, t(`hackemcoins.${change}.help`), msg);

        const amount = Number(amountString);

        if (!Number.isSafeInteger(amount) || amount <= 0)
            return bot.sendMessageExt(msg.chat.id, t("hackemcoins.errors.amount"), msg);

        const target = helpers.resolveTargetUser(msg, username);

        if (!target) return bot.sendMessageExt(msg.chat.id, t("general.errors.nouser"), msg);

        const actor = bot.context(msg).user;
        const { apply, notification } = HackemcoinsController.balanceChanges[change];
        const { transaction, balance } = apply(target, actor, amount, reason);
        const params = {
            id: transaction.id,
            actor: helpers.userLink(actor),
            username: helpers.userLink(target),
            amount,
            reason,
            balance,
        };

        await bot.sendMessageExt(msg.chat.id, t(`hackemcoins.${change}.success`, params), msg);
        await bot.sendAlert(t(`hackemcoins.${change}.log`, params));

        if (notification && target.userid !== actor.userid) await bot.sendDirectMessage(target, notification, params);

        return;
    }

    static async donationRewardedHandler(bot: HackerEmbassyBot, { donation, transaction, balance }: DonationRewardEvent) {
        const user = userService.getUser(donation.user_id);

        if (!user) return;

        await bot.sendDirectMessage(user, "hackemcoins.received.donation", {
            amount: transaction.amount,
            balance,
            fundName: fundsService.getFundById(donation.fund_id)?.name,
        });
    }
}
