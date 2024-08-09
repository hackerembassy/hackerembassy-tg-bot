import config from "config";

import { BotConfig } from "@config";
import { HALFDAY, HOUR, MINUTE } from "@utils/date";

import HackerEmbassyBot from "./core/HackerEmbassyBot";
import { BotCustomEvent } from "./core/types";
import BirthdayHandlers from "./handlers/birthday";
import EmbassyHandlers from "./handlers/embassy";
import MemeHandlers from "./handlers/meme";
import StatusHandlers from "./handlers/status";

const botConfig = config.get<BotConfig>("bot");

export function setAutomaticFeatures(bot: HackerEmbassyBot): void {
    setInterval(() => BirthdayHandlers.sendBirthdayWishes(bot, null, false), 6 * HOUR);
    setInterval(() => MemeHandlers.remindItIsWednesdayHandler(bot), 6 * HOUR);
    setInterval(
        () =>
            bot.sendNotification(
                `📢 Котики, сегодня надо заплатить за газ и электричество, не забудьте пожалуйста`,
                13,
                botConfig.chats.key
            ),
        HALFDAY
    );
    setInterval(
        () =>
            bot.sendNotification(
                `📢 Котики, сегодня надо заплатить за интернет 9900 AMD, не забудьте пожалуйста`,
                13,
                botConfig.chats.key
            ),
        HALFDAY
    );
    setInterval(
        () =>
            bot.sendNotification(
                `📢 Котики, проверьте оплату за газ и электричество, иначе их отключат завтра`,
                20,
                botConfig.chats.key
            ),
        HALFDAY
    );
    setInterval(
        () => bot.sendNotification(`📢 Котики, проверьте оплату за интернет, иначе его отключат завтра`, 18, botConfig.chats.key),
        HALFDAY
    );

    setInterval(() => StatusHandlers.autoinout(bot, true), botConfig.timeouts.in);
    setInterval(() => StatusHandlers.autoinout(bot, false), botConfig.timeouts.out);
    setInterval(() => StatusHandlers.timedOutHandler(bot), MINUTE);

    setInterval(() => EmbassyHandlers.checkOutageMentionsHandler(bot), HOUR / 6);

    setInterval(() => bot.CustomEmitter.emit(BotCustomEvent.camLive), botConfig.live.camRefreshInterval);
    setInterval(() => bot.CustomEmitter.emit(BotCustomEvent.statusLive), botConfig.live.statusRefreshInterval);
}
