class Donation {
    /**
     * Represents a donation to a fund.
     * @constructor
     * @param {Object} params - The parameters for creating a fund.
     * @param {number} params.id - The ID of the fund.
     * @param {string} params.username - The name of the user who owns the fund.
     * @param {number} params.fund_id - The ID of the fund.
     * @param {number} params.value - The value of the fund.
     * @param {string} params.currency - The currency of the fund's value.
     * @param {string} params.accountant - The name of the accountant who manages the fund.
     */
    constructor({ id, username, fund_id, value, currency, accountant }) {
        this.id = id;
        this.username = username;
        this.fund_id = fund_id;
        this.value = value;
        this.currency = currency;
        this.accountant = accountant;
    }
}

module.exports = Donation;
