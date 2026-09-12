import { Donation, DonationEx, Fund, User } from "@data/models";
import FundsRepository from "@data/repositories/funds";

import logger from "@services/common/logger";

import { parseMoneyValue, prepareCurrency, sumDonations } from "./currency";
import { getSponsorshipLevel, getSponsorshipStartPeriodDate, getUserDonationMap } from "./sponsorship";
import { userService } from "../user";

export { COSTS_PREFIX } from "@data/repositories/funds";
export { SponsorshipLevel, SponsorshipLevelToEmoji, SponsorshipLevelToName, SponsorshipNameToLevel } from "./sponsorship";

export interface DonationResult {
    donationId: number;
    amount: number;
    currency: string;
    hasAlreadyDonated: boolean;
    hasUpdatedSponsorship: boolean;
    newSponsorshipLevel: number;
}

class FundsService {
    // Funds
    public getAllFunds() {
        return FundsRepository.getAllFunds();
    }

    public getFundsByStatus(status: string) {
        return FundsRepository.getFundsByStatus(status);
    }

    public getFundByName(fundName: string) {
        return FundsRepository.getFundByName(fundName);
    }

    public getFundById(id: number) {
        return FundsRepository.getFundById(id);
    }

    public getLatestCosts() {
        return FundsRepository.getLatestCosts();
    }

    // Resolves a fund by name, defaulting to the current costs/rent fund when no name is given
    public resolveCostsFund(fundName?: string): Fund | undefined {
        return fundName ? FundsRepository.getFundByName(fundName) : FundsRepository.getLatestCosts();
    }

    public getCostsFundDonations(year?: number) {
        return FundsRepository.getCostsFundDonations(year);
    }

    public addFund(fund: Omit<Fund, "id">) {
        return FundsRepository.addFund(fund);
    }

    public updateFund(fund: Fund) {
        return FundsRepository.updateFund(fund);
    }

    public removeFund(fundName: string) {
        return FundsRepository.removeFundByName(fundName);
    }

    public closeFund(fundName: string) {
        return FundsRepository.closeFund(fundName);
    }

    public changeFundStatus(fundName: string, status: string) {
        return FundsRepository.changeFundStatus(fundName, status);
    }

    // Donations
    public getAllDonations(joinFunds = false, joinUsers = false, since?: Date) {
        return FundsRepository.getAllDonations(joinFunds, joinUsers, since);
    }

    public getDonationsForFund(fundId: number, joinFunds = false, joinUsers = false) {
        return FundsRepository.getDonationsForFundId(fundId, joinFunds, joinUsers);
    }

    public getDonationsForName(fundName: string) {
        return FundsRepository.getDonationsForName(fundName);
    }

    public getDonationsOf(userId: number, joinFunds = false, joinUsers = false, since?: Date) {
        return FundsRepository.getDonationsOf(userId, joinFunds, joinUsers, since);
    }

    public getDonationsOfUsers(userIds: number[], since?: Date) {
        return FundsRepository.getDonationsOfUsers(userIds, since);
    }

    public getFundDonationsHeldBy(accountantId: number, fundId?: number) {
        return FundsRepository.getFundDonationsHeldBy(accountantId, fundId);
    }

    public getDonationById(donationId: number, joinFunds = false, joinUsers = false) {
        return FundsRepository.getDonationById(donationId, joinFunds, joinUsers);
    }

    public removeDonation(donationId: number) {
        return FundsRepository.removeDonationById(donationId);
    }

    public updateDonation(donation: Donation) {
        return FundsRepository.updateDonation(donation);
    }

    public transferDonation(donationId: number, accountantId: number) {
        return FundsRepository.transferDonation(donationId, accountantId);
    }

    // Business logic
    public async donate(
        fundName: string,
        amount: number,
        currency: string,
        user: User,
        accountant: User
    ): Promise<DonationResult> {
        const fund = FundsRepository.getFundByName(fundName);

        if (!fund) throw new Error("Fund not found");

        const hasAlreadyDonated = FundsRepository.getDonationsForName(fundName).some(
            donation => donation.user_id === user.userid
        );

        const lastInsertRowid = FundsRepository.addDonationTo(fund.id, user.userid, amount, accountant.userid, currency);

        if (!lastInsertRowid) throw new Error("Failed to add donation");

        const userDonations = FundsRepository.getDonationsOf(user.userid, false, false, getSponsorshipStartPeriodDate());
        const { updated: hasUpdatedSponsorship, level: newSponsorshipLevel } = await this.recalculateSponsorship(
            user,
            userDonations
        );

        return {
            donationId: Number(lastInsertRowid),
            amount,
            currency,
            hasAlreadyDonated,
            hasUpdatedSponsorship,
            newSponsorshipLevel,
        };
    }

    public async refreshAllSponsorships(): Promise<void> {
        const donations = FundsRepository.getAllDonations(false, true, getSponsorshipStartPeriodDate());
        const sponsorDataMap = getUserDonationMap(donations);

        for (const { user, donations: userDonations } of sponsorDataMap) {
            await this.recalculateSponsorship(user, userDonations);
        }
    }

    public async recalculateSponsorship(user: User, donations: Donation[]): Promise<{ updated: boolean; level: number }> {
        const oldSponsorship = user.sponsorship;
        const newSponsorship = await getSponsorshipLevel(donations);
        const updated = oldSponsorship !== newSponsorship;

        if (updated) {
            user.sponsorship = newSponsorship;
            userService.saveUser(user);
            logger.info(`Updated sponsorship for ${user.username} from ${oldSponsorship} to ${newSponsorship}`);
        }

        return { updated, level: newSponsorship };
    }

    public getResidentsDonationStatus(donations: Donation[], residents: User[], option: "all" | "paid" | "left" = "all") {
        const donorIds = new Set(donations.map(d => d.user_id));

        return residents
            .map(resident => ({ resident, hasDonated: donorIds.has(resident.userid) }))
            .filter(
                ({ hasDonated }) => option === "all" || (option === "paid" && hasDonated) || (option === "left" && !hasDonated)
            );
    }

    // Parses and validates raw target/currency input before creating an open fund
    public async createFund(
        fundName: string,
        targetString: string,
        currencyString: string
    ): Promise<Omit<Fund, "id"> | undefined> {
        const targetValue = parseMoneyValue(targetString);
        const preparedCurrency = await prepareCurrency(currencyString);

        if (Number.isNaN(targetValue) || !preparedCurrency) return undefined;

        const fund = { name: fundName, target_value: targetValue, target_currency: preparedCurrency, status: "open" };

        return this.addFund(fund) ? fund : undefined;
    }

    // Parses and validates raw target/currency input before updating an existing fund
    public async updateFundDetails(
        fund: Fund,
        targetString: string,
        currencyString: string,
        newFundName?: string
    ): Promise<Fund | undefined> {
        const targetValue = parseMoneyValue(targetString);
        const preparedCurrency = await prepareCurrency(currencyString);

        if (Number.isNaN(targetValue) || !preparedCurrency) return undefined;

        const updatedFund: Fund = {
            ...fund,
            name: newFundName && newFundName.length > 0 ? newFundName : fund.name,
            target_value: targetValue,
            target_currency: preparedCurrency,
        };

        return this.updateFund(updatedFund) ? updatedFund : undefined;
    }

    // Transfers each donation to the accountant, reporting per-donation success
    public transferDonations(donationIds: number[], accountantId: number) {
        return donationIds.map(donationId => {
            const success = this.transferDonation(donationId, accountantId);
            const donation = this.getDonationById(donationId, true, true);

            return { donationId, success: success && !!donation, donation };
        });
    }

    // Parses and validates raw value/currency input before updating an existing donation's amount
    public async applyDonationAmount(
        donation: Donation,
        valueString: string,
        currencyString: string
    ): Promise<Donation | undefined> {
        const value = parseMoneyValue(valueString);
        const preparedCurrency = await prepareCurrency(currencyString);

        if (Number.isNaN(value) || !preparedCurrency) return undefined;

        const updatedDonation = { ...donation, value, currency: preparedCurrency };

        return this.updateDonation(updatedDonation) ? updatedDonation : undefined;
    }

    public async getDebtSummary(userId: number): Promise<{ donations: DonationEx[]; total: number }> {
        const donations = this.getFundDonationsHeldBy(userId);
        const total = donations.length > 0 ? await sumDonations(donations) : 0;

        return { donations, total };
    }
}

export const fundsService = new FundsService();
