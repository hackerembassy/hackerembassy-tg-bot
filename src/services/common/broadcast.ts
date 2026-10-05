import { EventEmitter } from "node:events";

export const enum BroadcastEvents {
    SpaceOpened = "space-opened",
    SpaceClosed = "space-closed",
    SpaceUnlocked = "space-unlocked",
    DonationAdded = "donation-added",
    DonationChanged = "donation-changed",
    DonationRemoved = "donation-removed",
    HackemcoinsDonationRewarded = "hackemcoins-donation-rewarded",
    HackemcoinsDonationAdjusted = "hackemcoins-donation-adjusted",
}

const broadcast = new EventEmitter();

export default broadcast;
