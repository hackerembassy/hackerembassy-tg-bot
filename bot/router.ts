/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import broadcast, { BroadcastEvents } from "@services/common/broadcast";

import HackerEmbassyBot from "./core/HackerEmbassyBot";
import AdminHandlers from "./handlers/admin";
import BasicHandlers from "./handlers/basic";
import BirthdayHandlers from "./handlers/birthday";
import EmbassyHandlers from "./handlers/embassy";
import FundsHandlers from "./handlers/funds";
import MemeHandlers from "./handlers/meme";
import NeedsHandlers from "./handlers/needs";
import ServiceHandlers from "./handlers/service";
import StatusHandlers from "./handlers/status";
import TopicsHandlers from "./handlers/subscriptions";

export function addControllers(bot: HackerEmbassyBot): void {
    bot.addController(AdminHandlers);
    bot.addController(BasicHandlers);
    bot.addController(BirthdayHandlers);
    bot.addController(EmbassyHandlers);
    bot.addController(FundsHandlers);
    bot.addController(MemeHandlers);
    bot.addController(NeedsHandlers);
    bot.addController(ServiceHandlers);
    bot.addController(StatusHandlers);
    bot.addController(TopicsHandlers);
}

export function addSpecialRoutes(bot: HackerEmbassyBot): void {
    bot.addEventRoutes(EmbassyHandlers.voiceInSpaceHandler, ServiceHandlers.newMemberHandler);
}

export function addEventHandlers(bot: HackerEmbassyBot) {
    broadcast.addListener(BroadcastEvents.SpaceOpened, state => {
        StatusHandlers.openedNotificationHandler(bot, state);
    });
    broadcast.addListener(BroadcastEvents.SpaceClosed, state => {
        StatusHandlers.closedNotificationHandler(bot, state);
    });
    broadcast.addListener(BroadcastEvents.SpaceUnlocked, username => {
        EmbassyHandlers.unlockedNotificationHandler(bot, username);
    });
}
