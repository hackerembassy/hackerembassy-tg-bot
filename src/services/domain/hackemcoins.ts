import config from "config";

import { BotConfig } from "@config";
import { HackemcoinTransaction, User } from "@data/models";
import HackemcoinsRepository from "@data/repositories/hackemcoins";

import { convertCurrency } from "./funds/currency";

const botConfig = config.get<BotConfig>("bot");

export interface HackemcoinOperationResult {
    transaction: HackemcoinTransaction;
    balance: number;
}

class HackemcoinsService {
    public readonly enabled = botConfig.features.hackemcoins;
    public readonly currency = botConfig.hackemcoins.currency;
    public readonly rate = botConfig.hackemcoins.rate;
    public readonly donationRewardPercent = botConfig.hackemcoins.donationRewardPercent;

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

    public async calculateDonationReward(value: number, currency: string): Promise<number> {
        if (!this.enabled) return 0;

        const converted = await convertCurrency(value, currency, this.currency);

        if (!converted) return 0;

        return Math.floor((converted * this.donationRewardPercent) / (100 * this.rate));
    }

    public rewardDonation(donationId: number, userId: number, accountantId: number, reward: number) {
        if (reward <= 0) return;

        return HackemcoinsRepository.addTransaction({
            user_id: userId,
            actor_id: accountantId,
            amount: reward,
            type: "donation",
            donation_id: donationId,
            reason: null,
            snack_id: null,
            ref_id: null,
        });
    }

    // Donations made before hackemcoins existed have no reward entry and must not earn coins retroactively when edited
    public adjustDonationReward(
        donationId: number,
        userId: number,
        actorId: number,
        newReward: number
    ): HackemcoinOperationResult | undefined {
        if (!this.enabled || !HackemcoinsRepository.getDonationReward(donationId)) return undefined;

        const delta = newReward - HackemcoinsRepository.getDonationRewardTotal(donationId);

        if (delta === 0) return undefined;

        return HackemcoinsRepository.addTransaction({
            user_id: userId,
            actor_id: actorId,
            amount: delta,
            type: "donation_adjust",
            donation_id: donationId,
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
