const BaseRepository = require("./baseRepository");

const isToday = someDate => {
    const today = new Date();
    return (
        someDate.getDate() == today.getDate() &&
        someDate.getMonth() == today.getMonth() &&
        someDate.getFullYear() == today.getFullYear()
    );
};

class StatusRepository extends BaseRepository {
    ChangeType = {
        Manual: 0,
        Auto: 1,
        Force: 2,
        Opened: 3,
        Evicted: 4,
    };

    UserStatusType = {
        Outside: 0,
        Inside: 1,
        Going: 2,
    };

    getSpaceLastState() {
        let lastState = this.db.prepare("SELECT * FROM states ORDER BY date DESC").get();

        if (!lastState) return null;

        lastState.date = new Date(lastState.date);

        return lastState;
    }

    getLastStatuses() {
        let userstates = this.db.prepare("SELECT * FROM userstates ORDER BY date DESC").all();
        let usersLastStatuses = [];

        for (const userstate of userstates) {
            if (!usersLastStatuses.find(us => us.username === userstate.username)) {
                userstate.date = new Date(userstate.date);
                usersLastStatuses.push(userstate);
            }
        }

        return usersLastStatuses;
    }

    getPeopleInside() {
        let usersLastStatuses = this.getLastStatuses();
        let usersInside = usersLastStatuses.filter(us => us.status === this.UserStatusType.Inside);

        return usersInside;
    }

    getPeopleGoing() {
        let usersLastStatuses = this.getLastStatuses();
        let usersGoing = usersLastStatuses.filter(us => us.status === this.UserStatusType.Going && isToday(us.date));

        return usersGoing;
    }

    evictPeople() {
        let inside = this.getPeopleInside();
        let date = Date.now();

        for (const userstate of inside) {
            this.pushPeopleState({
                status: this.UserStatusType.Outside,
                date: date,
                username: userstate.username,
                type: this.ChangeType.Evicted,
            });
        }
    }

    pushSpaceState(state) {
        this.db
            .prepare("INSERT INTO states (open, changedby, date) VALUES (?, ?, ?)")
            .run(state.open ? 1 : 0, state.changedby, state.date.valueOf());
    }

    pushPeopleState(state) {
        this.db
            .prepare("INSERT INTO userstates (status, username, date, type) VALUES (?, ?, ?, ?)")
            .run(
                state.status ? state.status : this.UserStatusType.Outside,
                state.username,
                state.date.valueOf(),
                state.type ?? 0
            );
    }
}

module.exports = new StatusRepository();
