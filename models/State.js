class State {
    /**
     * Represents a state of the space.
     * @constructor
     * @param {object} params - The parameters for creating a change record.
     * @param {number} params.id - The ID of the item being changed.
     * @param {boolean} params.open - Whether the item is currently open or not.
     * @param {string} params.changedby - The name of the user who made the change.
     * @param {number|Date} params.date - The date and time when the change was made.
     */
    constructor({ id, open, changedby, date }) {
        this.id = id;
        this.open = open;
        this.changedby = changedby;
        this.date = date;
    }
}

module.exports = State;
