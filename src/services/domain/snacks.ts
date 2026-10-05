import { HackemcoinTransaction, Snack, User } from "@data/models";
import SnacksRepository from "@data/repositories/snacks";
import { runInTransaction } from "@data/repositories/base";

import { hackemcoinsService } from "./hackemcoins";

export type PurchaseResult =
    | { status: "notfound" }
    | { status: "outofstock"; snack: Snack }
    | { status: "insufficient"; snack: Snack; balance: number }
    | { status: "success"; snack: Snack; transaction: HackemcoinTransaction; balance: number };

export type UndoPurchaseResult =
    | { status: "notfound" }
    | { status: "alreadyundone" }
    | { status: "success"; purchase: HackemcoinTransaction; snack: Snack; transaction: HackemcoinTransaction; balance: number };

export type SnackChange = { snack: Snack; previous: Snack };

class SnacksService {
    public getSnacks() {
        return SnacksRepository.getSnacks();
    }

    public getSnack(name: string) {
        const snack = SnacksRepository.getSnackByName(name.trim());

        return snack && !snack.removed ? snack : undefined;
    }

    public addSnack(name: string, price: number, stock: number, creator: User): Snack | undefined {
        return runInTransaction(() => {
            const trimmedName = name.trim();
            const existing = SnacksRepository.getSnackByName(trimmedName);

            if (!existing) return SnacksRepository.addSnack({ name: trimmedName, price, stock, created_by: creator.userid });

            if (!existing.removed) return;

            return SnacksRepository.updateSnack(existing.id, {
                name: trimmedName,
                price,
                stock,
                removed: false,
                created_by: creator.userid,
            });
        });
    }

    public setStock(name: string, stock: number): Optional<SnackChange> {
        return this.updateSnack(name, { stock });
    }

    public setPrice(name: string, price: number): Optional<SnackChange> {
        return this.updateSnack(name, { price });
    }

    public removeSnack(name: string): Optional<SnackChange> {
        return this.updateSnack(name, { removed: true });
    }

    public purchase(name: string, buyer: User): PurchaseResult {
        return runInTransaction(() => {
            const snack = this.getSnack(name);

            if (!snack) return { status: "notfound" };
            if (snack.stock <= 0) return { status: "outofstock", snack };

            const balance = hackemcoinsService.getBalance(buyer.userid);

            if (balance < snack.price) return { status: "insufficient", snack, balance };

            const updatedSnack = SnacksRepository.changeStock(snack.id, -1);

            if (!updatedSnack) throw new Error(`Failed to update the stock of snack ${snack.id}`);

            const result = hackemcoinsService.chargePurchase(buyer, snack.id, snack.price);

            return { status: "success", snack: updatedSnack, ...result };
        });
    }

    public undoPurchase(purchaseId: number, actor: User): UndoPurchaseResult {
        return runInTransaction(() => {
            const purchase = hackemcoinsService.getTransactionById(purchaseId);

            if (purchase?.type !== "purchase" || !purchase.snack_id) return { status: "notfound" };
            if (hackemcoinsService.isUndone(purchase.id)) return { status: "alreadyundone" };

            const snack = SnacksRepository.changeStock(purchase.snack_id, 1);

            if (!snack) throw new Error(`Failed to update the stock of snack ${purchase.snack_id}`);

            const result = hackemcoinsService.refundPurchase(purchase, actor);

            return { status: "success", purchase, snack, ...result };
        });
    }

    private updateSnack(name: string, changes: Partial<Snack>): Optional<SnackChange> {
        return runInTransaction(() => {
            const previous = this.getSnack(name);

            if (!previous) return;

            const snack = SnacksRepository.updateSnack(previous.id, changes);

            return snack ? { snack, previous } : undefined;
        });
    }
}

export const snacksService = new SnacksService();
