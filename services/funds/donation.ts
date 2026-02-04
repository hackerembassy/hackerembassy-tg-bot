import { User } from "@data/models";
import FundsRepository from "@repositories/funds";
import { userService } from "@services/domain/user";

import { getSponsorshipLevel, getSponsorshipStartPeriodDate } from "./export";

export interface DonationResult {
    donationId: number;
    amount: number;
    currency: string;
    hasAlreadyDonated: boolean;
    hasUpdatedSponsorship: boolean;
    newSponsorshipLevel: number;
}

export async function donateToFund(fundName: string, amount: number, currency: string, user: User, accountant: User) {
    const fund = FundsRepository.getFundByName(fundName);

    if (!fund) throw new Error("Fund not found");

    // Check if user has already donated to this fund
    const existingUserDonations = FundsRepository.getDonationsForName(fundName).filter(
        donation => donation.user_id === user.userid
    );
    const hasAlreadyDonated = existingUserDonations.length > 0;

    // Add donation to the fund
    const lastInsertRowid = FundsRepository.addDonationTo(fund.id, user.userid, amount, accountant.userid, currency);

    if (!lastInsertRowid) throw new Error("Failed to add donation");

    // Update user sponsorship level
    const userDonations = FundsRepository.getDonationsOf(user.userid, false, false, getSponsorshipStartPeriodDate());
    const newSponsorshipLevel = await getSponsorshipLevel(userDonations);
    const hasUpdatedSponsorship = user.sponsorship !== newSponsorshipLevel;

    if (hasUpdatedSponsorship) {
        user.sponsorship = newSponsorshipLevel;
        userService.saveUser(user);
    }

    return {
        donationId: Number(lastInsertRowid),
        amount,
        currency,
        hasAlreadyDonated,
        hasUpdatedSponsorship,
        newSponsorshipLevel: newSponsorshipLevel,
    };
}
