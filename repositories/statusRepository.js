const BaseRepository = require("./baseRepository");

class StatusRepository extends BaseRepository {
  getSpaceLastState() {
    let lastState = this.db
      .prepare("SELECT * FROM states ORDER BY date DESC")
      .get();

    if (!lastState) return null;

    lastState.date = new Date(lastState.date);

    return lastState;
  }

  getPeopleInside() {
    let userstates = this.db
      .prepare("SELECT * FROM userstates ORDER BY date DESC")
      .all();
    let usersLastStatuses = [];

    for (const userstate of userstates) {
      if (!usersLastStatuses.find(us => us.username === userstate.username)) {
        userstate.date = new Date(userstate.date);
        usersLastStatuses.push(userstate);
      }
    }

    let usersInside = usersLastStatuses.filter((us) => us.inside);

    return usersInside;
  }
  evictPeople() {
    let inside = this.getPeopleInside();
    let date = Date.now();

    for (const userstate of inside) {
      this.pushPeopleState({
        inside: false,
        date: date,
        username: userstate.username,
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
      .prepare(
        "INSERT INTO userstates (inside, username, date) VALUES (?, ?, ?)"
      )
      .run(state.inside ? 1 : 0, state.username, state.date.valueOf());
  }
}

module.exports = new StatusRepository();
