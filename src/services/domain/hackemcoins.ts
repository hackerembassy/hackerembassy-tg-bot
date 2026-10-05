import config from "config";

import { BotConfig } from "@config";
import { Donation, HackemcoinTransaction, User } from "@data/models";
import HackemcoinsRepository from "@data/repositories/hackemcoins";

import broadcast, { BroadcastEvents } from "@services/common/broadcast";

import { convertCurrency } from "./funds/currency";
import type { DonationEvent } from "./funds";

const botConfig = config.get<BotConfig>("bot");

export interface HackemcoinOperationResult {
    transaction: HackemcoinTransaction;
    balance: number;
}

export type DonationAdjustment = "changed" | "removed";

export interface DonationRewardEvent extends HackemcoinOperationResult {
    donation: Donation;
}

class HackemcoinsService {
    public readonly enabled = botConfig.features.hackemcoins;
    public readonly currency = botConfig.hackemcoins.currency;
    public readonly rate = botConfig.hackemcoins.rate;
    public readonly donationRewardPercent = botConfig.hackemcoins.donationRewardPercent;

    // Donation events are handled one at a time so a quick change/removal can't overtake the reward it corrects
    private donationQueue: Promise<unknown> = Promise.resolve();

    public getBalance(userId: number) {
        return HackemcoinsRepository.getBalance(userId);
    }

    public getHistory(userId: number, limit = 10) {
        return HackemcoinsRepository.getTransactionsOf(userId, limit);
    }

    public getTransactionById(id: number) {
        return HackemcoinsRepository.getTransactionById(id);
    }

    public isUndone(transactionId: number) {
        return !!HackemcoinsRepository.getTransactionReferencing(transactionId);
    }

    private readonly adjustedRewards: Record<DonationAdjustment, (donation: Donation) => Promise<number>> = {
        changed: donation => this.calculateDonationReward(donation),
        removed: () => Promise.resolve(0),
    };

    public rewardDonation(event: DonationEvent): Promise<unknown> {
        return this.enqueue(() => this.applyDonationReward(event));
    }

    public adjustDonationReward(event: DonationEvent, change: DonationAdjustment): Promise<unknown> {
        return this.enqueue(async () => this.applyDonationAdjustment(event, await this.adjustedRewards[change](event.donation)));
    }

    private enqueue(task: () => unknown): Promise<unknown> {
        const run = this.donationQueue.then(task);

        this.donationQueue = run.catch(() => null);

        return run;
    }

    private async calculateDonationReward(donation: Donation): Promise<number> {
        const converted = await convertCurrency(donation.value, donation.currency, this.currency);

        if (!converted) return 0;

        return Math.floor((converted * this.donationRewardPercent) / (100 * this.rate));
    }

    private async applyDonationReward({ donation, actor }: DonationEvent) {
        const reward = await this.calculateDonationReward(donation);

        if (reward <= 0 || HackemcoinsRepository.getDonationReward(donation.id)) return;

        const result = HackemcoinsRepository.addTransaction({
            user_id: donation.user_id,
            actor_id: actor.userid,
            amount: reward,
            type: "donation",
            donation_id: donation.id,
            reason: null,
            snack_id: null,
            ref_id: null,
        });

        await broadcast.emitAsync(BroadcastEvents.HackemcoinsDonationRewarded, {
            donation,
            ...result,
        } satisfies DonationRewardEvent);
    }

    // Donations made before hackemcoins existed have no reward entry and must not earn coins retroactively when edited
    private applyDonationAdjustment({ donation, actor }: DonationEvent, newReward: number) {
        if (!HackemcoinsRepository.getDonationReward(donation.id)) return;

        const delta = newReward - HackemcoinsRepository.getDonationRewardTotal(donation.id);

        if (delta === 0) return;

        HackemcoinsRepository.addTransaction({
            user_id: donation.user_id,
            actor_id: actor.userid,
            amount: delta,
            type: "donation_adjust",
            donation_id: donation.id,
            reason: null,
            snack_id: null,
            ref_id: null,
        });
    }

    public grant(target: User, actor: User, amount: number, reason: string) {
        return HackemcoinsRepository.addTransaction({
            user_id: target.userid,
            actor_id: actor.userid,
            amount,
            type: "grant",
            reason,
            donation_id: null,
            snack_id: null,
            ref_id: null,
        });
    }

    public deduct(target: User, actor: User, amount: number, reason: string) {
        return HackemcoinsRepository.addTransaction({
            user_id: target.userid,
            actor_id: actor.userid,
            amount: -amount,
            type: "deduct",
            reason,
            donation_id: null,
            snack_id: null,
            ref_id: null,
        });
    }

    public chargePurchase(buyer: User, snackId: number, price: number) {
        return HackemcoinsRepository.addTransaction({
            user_id: buyer.userid,
            actor_id: buyer.userid,
            amount: -price,
            type: "purchase",
            snack_id: snackId,
            reason: null,
            donation_id: null,
            ref_id: null,
        });
    }

    public refundPurchase(purchase: HackemcoinTransaction, actor: User) {
        return HackemcoinsRepository.addTransaction({
            user_id: purchase.user_id,
            actor_id: actor.userid,
            amount: -purchase.amount,
            type: "purchase_undo",
            snack_id: purchase.snack_id,
            ref_id: purchase.id,
            reason: null,
            donation_id: null,
        });
    }
}

export const hackemcoinsService = new HackemcoinsService();
