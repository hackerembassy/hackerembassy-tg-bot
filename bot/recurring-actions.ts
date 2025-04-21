import config from "config";

import { BotConfig } from "@config";
import { DAY, HALFDAY, HOUR, MINUTE } from "@utils/date";

import HackerEmbassyBot from "./core/HackerEmbassyBot";
import { BotCustomEvent } from "./core/types";
import BirthdayHandlers from "./handlers/birthday";
import EmbassyHandlers from "./handlers/embassy";
import MemeHandlers from "./handlers/meme";
import StatusHandlers from "./handlers/status";
import FundsHandlers from "./handlers/funds";

const botConfig = config.get<BotConfig>("bot");

export function setAutomaticFeatures(bot: HackerEmbassyBot): void {
    // Live cam and status updates
    setInterval(() => bot.CustomEmitter.emit(BotCustomEvent.camLive), botConfig.live.camRefreshInterval);
    setInterval(() => bot.CustomEmitter.emit(BotCustomEvent.statusLive), botConfig.live.statusRefreshInterval);

    // Recalculate sponsorships
    setInterval(() => FundsHandlers.refreshSponsorshipsHandler(bot), DAY);

    // Autoinside polling
    if (botConfig.features.autoinside) {
        setInterval(() => StatusHandlers.autoinout(bot, true), botConfig.timeouts.in);
        setInterval(() => StatusHandlers.autoinout(bot, false), botConfig.timeouts.out);
        setInterval(() => StatusHandlers.timedOutHandler(bot), MINUTE);
    }

    // Embassy outage mentions
    if (botConfig.features.outage)
        setInterval(() => EmbassyHandlers.checkOutageMentionsHandler(bot), botConfig.outage.electricity.interval);

    // Utility and Internet payments notifications
    if (botConfig.features.reminders) setupPaymentReminders(bot);

    // Meme reminders
    if (botConfig.features.birthday) setInterval(() => BirthdayHandlers.sendBirthdayWishes(bot, null, false), 6 * HOUR);
    if (botConfig.features.wednesday) setInterval(() => MemeHandlers.remindItIsWednesdayHandler(bot), 6 * HOUR);
}

function setupPaymentReminders(bot: HackerEmbassyBot) {
    setInterval(
        () =>
            bot.sendNotification(botConfig.reminders.utility.message, botConfig.reminders.utility.firstDay, botConfig.chats.key),
        HALFDAY
    );
    setInterval(
        () =>
            bot.sendNotification(
                botConfig.reminders.internet.message,
                botConfig.reminders.internet.firstDay,
                botConfig.chats.key
            ),
        HALFDAY
    );
    setInterval(
        () => bot.sendNotification(botConfig.reminders.utility.warning, botConfig.reminders.utility.lastDay, botConfig.chats.key),
        HALFDAY
    );
    setInterval(
        () =>
            bot.sendNotification(botConfig.reminders.internet.warning, botConfig.reminders.internet.lastDay, botConfig.chats.key),
        HALFDAY
    );
}
