export const enum UserStateChangeType {
    Manual = 0,
    Auto = 1,
    Force = 2,
    Opened = 3,
    Evicted = 4,
    TimedOut = 5,
}

export const enum UserStateType {
    Outside = 0,
    Inside = 1,
    Going = 2,
    InsideSecret = 3,
}

class UserState {
    readonly id: number;
    username: string;
    status: UserStateType;
    date: number | Date;
    until: Nullable<Date>;
    type: UserStateChangeType;
    note: Nullable<string>;

    constructor({ id = 0, username, status, date, until = null, type = 0, note = null }: UserState) {
        this.id = id;
        this.username = username;
        this.status = status;
        this.date = date;
        this.until = until;
        this.type = type;
        this.note = note;
    }
}

export default UserState;
