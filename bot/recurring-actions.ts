import config from "config";
import { CronJob } from "cron";

import { BotConfig } from "@config";
import { MINUTE } from "@utils/date";

import HackerEmbassyBot from "./core/HackerEmbassyBot";
import { BotCustomEvent } from "./core/types";
import BirthdayHandlers from "./handlers/birthday";
import EmbassyHandlers from "./handlers/embassy";
import MemeHandlers from "./handlers/meme";
import StatusHandlers from "./handlers/status";
import FundsHandlers from "./handlers/funds";

const botConfig = config.get<BotConfig>("bot");

// Why am I storing this if I don't have plans to stop these jobs?
const runningJobs: CronJob[] = [];

export function setAutomaticFeatures(bot: HackerEmbassyBot) {
    setupShortIntervals(bot);
    setupCronJobs(bot);
}

// This are so short intervals that we can just use setInterval
function setupShortIntervals(bot: HackerEmbassyBot) {
    // Live cam and status updates
    setInterval(() => bot.customEmitter.emit(BotCustomEvent.camLive), botConfig.live.camRefreshInterval);
    setInterval(() => bot.customEmitter.emit(BotCustomEvent.statusLive), botConfig.live.statusRefreshInterval);

    // Autoinside polling
    if (botConfig.features.autoinside) {
        setInterval(() => StatusHandlers.autoinout(bot, true), botConfig.timeouts.in);
        setInterval(() => StatusHandlers.autoinout(bot, false), botConfig.timeouts.out);
        setInterval(() => StatusHandlers.timedOutHandler(bot), MINUTE);
    }
}

// This is a bit more complex, so we use cron jobs
function setupCronJobs(bot: HackerEmbassyBot): void {
    // Recalculate sponsorships
    runningJobs.push(new CronJob("0 0 * * *", () => FundsHandlers.refreshSponsorshipsHandler(bot)));

    // Embassy outage mentions
    if (botConfig.features.outage)
        runningJobs.push(new CronJob(botConfig.outage.electricity.cron, () => EmbassyHandlers.checkOutageMentionsHandler(bot)));

    // Utility and Internet payments notifications
    if (botConfig.features.reminders) {
        runningJobs.push(
            new CronJob(botConfig.reminders.utility.cron, () => {
                bot.sendMessageExt(botConfig.chats.key, botConfig.reminders.utility.message, null);
            })
        );
        runningJobs.push(
            new CronJob(botConfig.reminders.internet.cron, () => {
                bot.sendMessageExt(botConfig.chats.key, botConfig.reminders.internet.message, null);
            })
        );
    }

    // Meme reminders
    if (botConfig.features.birthday)
        runningJobs.push(new CronJob("0 0 * * *", () => BirthdayHandlers.sendBirthdayWishes(bot, null)));

    if (botConfig.features.wednesday)
        runningJobs.push(new CronJob("0 0 * * 3", () => MemeHandlers.remindItIsWednesdayHandler(bot)));

    // START THESE JOBS!!!
    runningJobs.forEach(job => job.start());
}
