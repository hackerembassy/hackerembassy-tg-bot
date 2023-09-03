class Donation {
    readonly id: number;
    username: string;
    fund_id: number;
    value: number;
    currency: string;
    accountant: string;

    constructor(id: number, username: string, fund_id: number, value: number, currency: string, accountant: string) {
        this.id = id;
        this.username = username;
        this.fund_id = fund_id;
        this.value = value;
        this.currency = currency;
        this.accountant = accountant;
    }
}

export default Donation;
