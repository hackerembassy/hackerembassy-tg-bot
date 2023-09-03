export const enum UserStateChangeType {
    Manual = 0,
    Auto = 1,
    Force = 2,
    Opened = 3,
    Evicted = 4,
}

export const enum UserStateType {
    Outside = 0,
    Inside = 1,
    Going = 2,
}

class UserState {
    readonly id: number;
    username: string;
    status: UserStateType;
    date: number | Date;
    type: UserStateChangeType;
    note: string | null;

    constructor(id = 0, username: string, status: UserStateType, date: number | Date, type = 0, note = null) {
        this.id = id;
        this.username = username;
        this.status = status;
        this.date = date;
        this.type = type;
        this.note = note;
    }
}

export default UserState;
