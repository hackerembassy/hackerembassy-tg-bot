class Need {
    readonly id: number;
    text: string;
    requester: string;
    buyer: string | null;
    updated: string;

    constructor({ id, text, requester, buyer = null, updated }: Need) {
        this.id = id;
        this.text = text;
        this.requester = requester;
        this.buyer = buyer;
        this.updated = updated;
    }
}

export default Need;
