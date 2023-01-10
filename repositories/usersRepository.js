const BaseRepository = require("./baseRepository");

class UserRepository extends BaseRepository {
  getUsers() {
    let users = this.db.prepare("SELECT * FROM users").all();

    return users.map((u) => {
      return {
        roles: u.roles.split("|"),
        username: u.username,
      };
    });
  }

  addUser(username, roles = ["default"]) {
    try {
      if (this.getUser(username) !== null) return false;
      roles = roles.join("|");
      this.db
        .prepare("INSERT INTO users (username, roles) VALUES (?, ?)")
        .run(username, roles);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  updateRoles(username, roles = ["default"]) {
    try {
      if (this.getUser(username) === null) return false;

      roles = roles.join("|");
      this.db
        .prepare("UPDATE users SET roles = ? WHERE username = ?")
        .run(roles, username);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  removeUser(username) {
    try {
      this.db.prepare("DELETE FROM users WHERE username = ?").run(username);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  getUser(username) {
    try {
      let user = this.db
        .prepare("SELECT * FROM users WHERE username = ?")
        .get(username);
      if (!user) return null;

      user.roles = user.roles.split("|");
      return user;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  getUsersByRole(role) {
    try {
      let users = this.db
        .prepare("SELECT * FROM users WHERE roles LIKE ('%' || ? || '%')")
        .all(role);

      return users;
    } catch (error) {
      console.log(error);
      return null;
    }
  }
}

module.exports = new UserRepository();
