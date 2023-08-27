class UserState {
    id: number;
    username: string;
    status: number;
    date: number | Date;
    type: number;
    note: string;

    constructor({ id = 0, username, status, date, type = 0, note = null }) {
        this.id = id;
        this.username = username;
        this.status = status;
        this.date = date;
        this.type = type;
        this.note = note;
    }
}

export default UserState;
