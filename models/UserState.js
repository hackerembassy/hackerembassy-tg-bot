class UserState {
    /**
     * Represents a user state.
     * @constructor
     * @param {object} params - The parameters for creating a user state.
     * @param {number} [params.id=0] - The unique ID of the user state.
     * @param {string} params.username - The username of the user.
     * @param {number} params.status - The status of the user.
     * @param {Date|number} params.date - The date the state was last updated.
     * @param {number} [params.type=0] - The type of the state, if any.
     */
    constructor({ id = 0, username, status, date, type = 0 }) {
        this.id = id;
        this.username = username;
        this.status = status;
        this.date = date;
        this.type = type;
    }
}

module.exports = UserState;
