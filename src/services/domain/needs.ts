import { User } from "@data/models";
import NeedsRepository from "@data/repositories/needs";

class NeedsService {
    public getOpenNeeds() {
        return NeedsRepository.getOpenNeeds();
    }

    public getNeedById(id: number) {
        return NeedsRepository.getNeedById(id);
    }

    public addBuy(item: string, requester: User) {
        return NeedsRepository.addBuy(item, requester.userid, new Date());
    }

    // Only the buyer who closed a need may undo it
    public undoClose(needId: number, requestingUser: User): boolean {
        const need = NeedsRepository.getNeedById(needId);

        if (!need || need.buyer_id !== requestingUser.userid) return false;

        return NeedsRepository.undoClose(need.id);
    }

    // A need can only be marked bought once, while it's still open
    public markBought(item: string, buyer: User) {
        const need = NeedsRepository.getOpenNeedByItem(item);

        if (!need || need.buyer_id) return;

        NeedsRepository.closeNeed(need.id, buyer.userid, new Date());

        return need;
    }
}

export const needsService = new NeedsService();
