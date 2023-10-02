import config from "config";

import { BotConfig } from "../../config/schema";
import HackerEmbassyBot, { BotCustomEvent } from "../core/HackerEmbassyBot";
import BirthdayHandlers from "../handlers/birthday";
import EmbassyHandlers from "../handlers/embassy";
import StatusHandlers from "../handlers/status";

const botConfig = config.get<BotConfig>("bot");

export function setAutomaticFeatures(bot: HackerEmbassyBot): void {
    EmbassyHandlers.enableStatusMonitor(bot);

    setInterval(() => BirthdayHandlers.sendBirthdayWishes(bot, null, false), 60 * 60 * 1000);
    setInterval(
        () =>
            bot.sendNotification(
                `📢 Котики, сегодня надо заплатить за газ и электричество, не забудьте пожалуйста`,
                13,
                botConfig.chats.key
            ),
        12 * 60 * 60 * 1000
    );
    setInterval(
        () =>
            bot.sendNotification(
                `📢 Котики, сегодня надо заплатить за интернет 9900 AMD, не забудьте пожалуйста`,
                13,
                botConfig.chats.key
            ),
        12 * 60 * 60 * 1000
    );
    setInterval(
        () =>
            bot.sendNotification(
                `📢 Котики, проверьте оплату за газ и электричество, иначе их отключат завтра`,
                20,
                botConfig.chats.key
            ),
        12 * 60 * 60 * 1000
    );
    setInterval(
        () => bot.sendNotification(`📢 Котики, проверьте оплату за интернет, иначе его отключат завтра`, 18, botConfig.chats.key),
        12 * 60 * 60 * 1000
    );

    setInterval(() => StatusHandlers.autoinout(bot, true), botConfig.timeouts.in);
    setInterval(() => StatusHandlers.autoinout(bot, false), botConfig.timeouts.out);

    setInterval(() => bot.CustomEmitter.emit(BotCustomEvent.camLive), botConfig.live.camRefreshInterval);
    setInterval(() => bot.CustomEmitter.emit(BotCustomEvent.statusLive), botConfig.live.statusRefreshInterval);
}
