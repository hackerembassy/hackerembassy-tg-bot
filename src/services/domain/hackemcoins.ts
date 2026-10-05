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

export interface DonationAdjustmentEvent extends DonationRewardEvent {
    change: DonationAdjustment;
}

class HackemcoinsService {
    public readonly enabled = botConfig.features.hackemcoins;
    public readonly currency = botConfig.hackemcoins.currency;
    public readonly rate = botConfig.hackemcoins.rate;
    public readonly donationRewardPercent = botConfig.hackemcoins.donationRewardPercent;

    // Donation events are handled one at a time so a quick change/removal can't overtake the reward it corrects
    private donationQueue: Promise<unknown> = Promise.resolve();

    constructor() {
        if (!this.enabled) return;

        broadcast.addAsyncListener(BroadcastEvents.DonationAdded, (event: DonationEvent) =>
            this.enqueue(() => this.rewardDonation(event))
        );
        broadcast.addAsyncListener(BroadcastEvents.DonationChanged, (event: DonationEvent) =>
            this.enqueue(async () =>
                this.adjustDonationReward(event, "changed", await this.calculateDonationReward(event.donation))
            )
        );
        broadcast.addAsyncListener(BroadcastEvents.DonationRemoved, (event: DonationEvent) =>
            this.enqueue(() => this.adjustDonationReward(event, "removed", 0))
        );
    }

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

    private async rewardDonation({ donation, actor }: DonationEvent) {
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
    private async adjustDonationReward({ donation, actor }: DonationEvent, change: DonationAdjustment, newReward: number) {
        if (!HackemcoinsRepository.getDonationReward(donation.id)) return;

        const delta = newReward - HackemcoinsRepository.getDonationRewardTotal(donation.id);

        if (delta === 0) return;

        const result = HackemcoinsRepository.addTransaction({
            user_id: donation.user_id,
            actor_id: actor.userid,
            amount: delta,
            type: "donation_adjust",
            donation_id: donation.id,
            reason: null,
            snack_id: null,
            ref_id: null,
        });

        await broadcast.emitAsync(BroadcastEvents.HackemcoinsDonationAdjusted, {
            donation,
            change,
            ...result,
        } satisfies DonationAdjustmentEvent);
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
