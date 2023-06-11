class Need {
    /**
     * Represents an item we ask people to buy.
     * @constructor
     * @param {object} params - The parameters for creating a text item.
     * @param {number} params.id - The ID of the text item.
     * @param {string} params.text - The text content of the item.
     * @param {string|null} params.requester - The name of the requester who requested the item (optional).
     * @param {string|null} params.buyer - The name of the buyer who bought the item (optional).
     * @param {string} params.updated - The date and time when the item was last updated.
     */
    constructor({ id, text, requester = null, buyer = null, updated }) {
        this.id = id;
        this.text = text;
        this.requester = requester;
        this.buyer = buyer;
        this.updated = updated;
    }
}

module.exports = Need;
