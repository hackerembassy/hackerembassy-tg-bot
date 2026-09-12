import config from "config";

import { BotConfig, SponsorshipLevelsConfig } from "@config";
import { Donation, DonationEx, User } from "@data/models";

const fundsConfig = config.get<BotConfig>("bot").funds;

export enum SponsorshipLevel {
    Platinum = 4,
    Gold = 3,
    Silver = 2,
    Bronze = 1,
    None = 0,
}

export const SponsorshipNameToLevel = new Map<keyof SponsorshipLevelsConfig, SponsorshipLevel>([
    ["bronze", SponsorshipLevel.Bronze],
    ["silver", SponsorshipLevel.Silver],
    ["gold", SponsorshipLevel.Gold],
    ["platinum", SponsorshipLevel.Platinum],
]);

export const SponsorshipLevelToName = new Map<SponsorshipLevel, keyof SponsorshipLevelsConfig>([
    [SponsorshipLevel.Bronze, "bronze"],
    [SponsorshipLevel.Silver, "silver"],
    [SponsorshipLevel.Gold, "gold"],
    [SponsorshipLevel.Platinum, "platinum"],
]);

export const SponsorshipLevelToEmoji = new Map<SponsorshipLevel, string>([
    [SponsorshipLevel.Bronze, "🥉"],
    [SponsorshipLevel.Silver, "🥈"],
    [SponsorshipLevel.Gold, "🥇"],
    [SponsorshipLevel.Platinum, "💎"],
]);

export function getUserDonationMap(donations: DonationEx[]) {
    const sponsorDataMap = new Map<number, { user: User; donations: Donation[] }>();

    for (const donation of donations) {
        let sponsorData = sponsorDataMap.get(donation.user_id);
        if (!sponsorData) {
            sponsorData = { user: donation.user, donations: [] };
            sponsorDataMap.set(donation.user_id, sponsorData);
        }
        sponsorData.donations.push(donation);
    }

    return sponsorDataMap.values();
}

export function getSponsorshipStartPeriodDate() {
    const startPeriodDate = new Date();
    startPeriodDate.setMonth(startPeriodDate.getMonth() - fundsConfig.sponsorship.period);
    return startPeriodDate;
}

export function getSponsorshipLevel(sum: number) {
    return sum >= fundsConfig.sponsorship.levels.platinum
        ? SponsorshipLevel.Platinum
        : sum >= fundsConfig.sponsorship.levels.gold
          ? SponsorshipLevel.Gold
          : sum >= fundsConfig.sponsorship.levels.silver
            ? SponsorshipLevel.Silver
            : sum >= fundsConfig.sponsorship.levels.bronze
              ? SponsorshipLevel.Bronze
              : SponsorshipLevel.None;
}
