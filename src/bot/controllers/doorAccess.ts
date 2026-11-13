import { Message } from "node-telegram-bot-api";

import { User } from "@data/models";
import { doorAccessService } from "@services/domain/doorAccess";
import { hasRole, isBanned } from "@services/domain/user";
import { FeatureFlag, Members, Route, Unlockers, UserRoles } from "@hackembot/core/decorators";

import { shortDateTimeOptions } from "@utils/date";

import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import { InlineButton } from "../core/inlineButtons";
import t, { getUserLanguage } from "../core/localization";
import { BotController } from "../core/types";
import * as helpers from "../core/helpers";

type TargetError = "banned" | "unlocker";

const formatWhen = (date: Date) => helpers.formatDateTime(date.toLocaleString("RU-ru", shortDateTimeOptions), date);

export default class DoorAccessController implements BotController {
    private static readonly targetRules: [TargetError, (target: User) => boolean][] = [
        ["banned", target => Boolean(isBanned(target))],
        ["unlocker", target => hasRole(target, "admin", ...Unlockers)],
    ];

    @Route(["grantaccess", "giveaccess"], helpers.OptionalParam(/(\S+) ([\s\S]*\S)/), match => [match[1], match[2]])
    @FeatureFlag("embassy")
    @UserRoles(Members)
    static async grantHandler(bot: HackerEmbassyBot, msg: Message, username?: string, windowText?: string) {
        const limits = { maxDays: doorAccessService.maxDurationDays, maxLeadDays: doorAccessService.maxLeadDays };

        if (!username || !windowText) return bot.sendMessageExt(msg.chat.id, t("access.grant.help", limits), msg);

        const window = doorAccessService.parseWindow(windowText);

        if (!window) return bot.sendMessageExt(msg.chat.id, t("access.grant.help", limits), msg);

        const target = helpers.resolveTargetUser(msg, username);

        if (!target) return bot.sendMessageExt(msg.chat.id, t("general.errors.nouser"), msg);

        const targetError = DoorAccessController.targetRules.find(([, applies]) => applies(target))?.[0];

        if (targetError)
            return bot.sendMessageExt(
                msg.chat.id,
                t(`access.errors.${targetError}`, { username: helpers.userLink(target) }),
                msg
            );

        const actor = bot.context(msg).user;
        const result = doorAccessService.grant(target, actor, window);

        if ("error" in result) return bot.sendMessageExt(msg.chat.id, t(`access.errors.${result.error}`, limits), msg);

        const params = {
            id: result.grant.id,
            actor: helpers.userLink(actor),
            username: helpers.userLink(target),
            from: formatWhen(result.grant.starts_at),
            to: formatWhen(result.grant.ends_at),
        };

        await bot.sendMessageExt(msg.chat.id, t("access.grant.success", params), msg);
        await bot.sendAlert(t("access.grant.log", params));

        const notification = await bot.sendDirectMessage(target, "access.received.grant", params, {
            reply_markup: {
                inline_keyboard: [[InlineButton(t("access.buttons.unlock", {}, getUserLanguage(target)), "unlock")]],
            },
        });

        if (!notification) await bot.sendMessageExt(msg.chat.id, t("access.grant.nodm", params), msg);

        return;
    }

    @Route(["revokeaccess"], helpers.OptionalParam(/(\S+)/), match => [match[1]])
    @FeatureFlag("embassy")
    @UserRoles(Members)
    static async revokeHandler(bot: HackerEmbassyBot, msg: Message, username?: string) {
        if (!username) return bot.sendMessageExt(msg.chat.id, t("access.revoke.help"), msg);

        const target = helpers.resolveTargetUser(msg, username);

        if (!target) return bot.sendMessageExt(msg.chat.id, t("general.errors.nouser"), msg);

        const actor = bot.context(msg).user;
        const revoked = doorAccessService.revoke(target, actor);
        const params = {
            ids: revoked.map(grant => `#\`${grant.id}#\``).join(", "),
            actor: helpers.userLink(actor),
            username: helpers.userLink(target),
        };

        if (revoked.length === 0) return bot.sendMessageExt(msg.chat.id, t("access.revoke.none", params), msg);

        await bot.sendMessageExt(msg.chat.id, t("access.revoke.success", params), msg);
        await bot.sendAlert(t("access.revoke.log", params));
        await bot.sendDirectMessage(target, "access.received.revoke", params);

        return;
    }
}
