import config from "config";
const botConfig = config.get("bot") as any;
import HackerEmbassyBot from "./HackerEmbassyBot";
import BirthdayHandlers from "./handlers/birthday";
import EmbassyHandlers from "./handlers/embassy";
import StatusHandlers from "./handlers/status";

export function setAutomaticFeatures(bot: HackerEmbassyBot) {
    EmbassyHandlers.enableStatusMonitor(bot);
    setInterval(() => BirthdayHandlers.sendBirthdayWishes(bot, undefined, false), 3600000); // 1hr
    setInterval(
        () =>
            bot.sendNotification(
                `📢 Котики, сегодня надо заплатить за газ и электричество, не забудьте пожалуйста`,
                "13",
                botConfig.chats.key
            ),
        43200000
    ); // 12hr
    setInterval(
        () =>
            bot.sendNotification(
                `📢 Котики, сегодня надо заплатить за интернет 9900 AMD, не забудьте пожалуйста`,
                "13",
                botConfig.chats.key
            ),
        43200000
    ); // 12hr
    setInterval(
        () =>
            bot.sendNotification(
                `📢 Котики, проверьте оплату за газ и электричество, иначе их отключат завтра`,
                "20",
                botConfig.chats.key
            ),
        43200000
    ); // 12hr
    setInterval(
        () =>
            bot.sendNotification(`📢 Котики, проверьте оплату за интернет, иначе его отключат завтра`, "18", botConfig.chats.key),
        43200000
    ); // 12hr

    setInterval(() => StatusHandlers.autoinout(true), botConfig.timeouts.in);
    setInterval(() => StatusHandlers.autoinout(false), botConfig.timeouts.out);
}
