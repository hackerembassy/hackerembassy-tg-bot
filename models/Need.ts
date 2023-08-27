class Need {
    id: number;
    text: string;
    requester: string;
    buyer: string;
    updated: string;

    constructor({ id, text, requester = null, buyer = null, updated }) {
        this.id = id;
        this.text = text;
        this.requester = requester;
        this.buyer = buyer;
        this.updated = updated;
    }
}

export default Need;
