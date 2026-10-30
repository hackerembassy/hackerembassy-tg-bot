import broadcast, { BroadcastEvents } from "@services/common/broadcast";
import { DonationEvent } from "@services/domain/funds";
import { hackemcoinsService } from "@services/domain/hackemcoins";

export function addHackemcoinsListeners() {
    if (!hackemcoinsService.enabled) return;

    broadcast.addAsyncListener(BroadcastEvents.DonationAdded, (event: DonationEvent) => hackemcoinsService.rewardDonation(event));
    broadcast.addAsyncListener(BroadcastEvents.DonationChanged, (event: DonationEvent) =>
        hackemcoinsService.adjustDonationReward(event, "changed")
    );
    broadcast.addAsyncListener(BroadcastEvents.DonationRemoved, (event: DonationEvent) =>
        hackemcoinsService.adjustDonationReward(event, "removed")
    );
}
