import broadcast, { BroadcastEvents } from "@services/common/broadcast";
import { DonationAdjustmentEvent, DonationRewardEvent } from "@services/domain/hackemcoins";

import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import HackemcoinsController from "../controllers/hackemcoins";

export function addHackemcoinsListeners(bot: HackerEmbassyBot) {
    broadcast.addAsyncListener(BroadcastEvents.HackemcoinsDonationRewarded, (event: DonationRewardEvent) =>
        HackemcoinsController.donationRewardedHandler(bot, event)
    );
    broadcast.addAsyncListener(BroadcastEvents.HackemcoinsDonationAdjusted, (event: DonationAdjustmentEvent) =>
        HackemcoinsController.donationAdjustedHandler(bot, event)
    );
}
