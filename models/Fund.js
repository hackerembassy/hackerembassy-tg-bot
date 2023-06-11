class Fund {
    /**
     * Represents a fund we want to collect.
     * @constructor
     * @param {object} params - The parameters for creating a goal.
     * @param {number} params.id - The ID of the goal.
     * @param {string} params.name - The name of the goal.
     * @param {number} params.target_value - The target value of the goal.
     * @param {string} params.target_currency - The currency the goal is valued in.
     * @param {string} params.status - The status of the goal item, defaults to "open".
     */
    constructor({ id, name, target_value, target_currency, status = "open" }) {
        this.id = id;
        this.name = name;
        this.target_value = target_value;
        this.target_currency = target_currency;
        this.status = status;
    }
}

module.exports = Fund;
