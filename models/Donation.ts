class Donation {
    readonly id: number;
    username: string;
    fund_id: number;
    value: number;
    currency: string;
    accountant: string;

    constructor({ id, username, fund_id, value, currency, accountant }: Donation) {
        this.id = id;
        this.username = username;
        this.fund_id = fund_id;
        this.value = value;
        this.currency = currency;
        this.accountant = accountant;
    }
}

export default Donation;
