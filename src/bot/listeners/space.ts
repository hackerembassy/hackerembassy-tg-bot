import { StateEx } from "@data/models";
import broadcast, { BroadcastEvents } from "@services/common/broadcast";

import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import EmbassyController from "../controllers/embassy";
import StatusController from "../controllers/status";

export function addSpaceListeners(bot: HackerEmbassyBot) {
    broadcast.addListener(
        BroadcastEvents.SpaceOpened,
        (state: StateEx) => void StatusController.openedNotificationHandler(bot, state)
    );
    broadcast.addListener(
        BroadcastEvents.SpaceClosed,
        (state: StateEx) => void StatusController.closedNotificationHandler(bot, state)
    );
    broadcast.addListener(
        BroadcastEvents.SpaceUnlocked,
        (username: string) => void EmbassyController.unlockedNotificationHandler(bot, username)
    );
}
