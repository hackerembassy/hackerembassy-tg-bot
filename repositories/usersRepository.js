const BaseRepository = require("./baseRepository");

class UserRepository extends BaseRepository {
  getUsers() {
    let users = this.db.prepare("SELECT * FROM users").all();

    return users.map((user) => ({
      roles: user.roles.split("|"),
      ...user
    })) ?? [];
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
      this.logger.error(error);
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
      this.logger.error(error);
      return false;
    }
  }

  setMAC(username, mac = null) {
    try {
      if (this.getUser(username) === null && !this.addUser(username, ["default"])) return false; 
      if (mac) mac = mac.toLowerCase().replaceAll("-",":");

      this.db
        .prepare("UPDATE users SET mac = ? WHERE username = ?")
        .run(mac, username);

      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  setEmoji(username, emoji = null) {
    try {
      if (this.getUser(username) === null && !this.addUser(username, ["default"])) return false; 

      this.db
        .prepare("UPDATE users SET emoji = ? WHERE username = ?")
        .run(emoji, username);

      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  setAutoinside(username, value) {
    try {
      let user = this.getUser(username);
      if (user === null && !this.addUser(username, ["default"]) || (value && !user.mac)) return false; 

      this.db
        .prepare("UPDATE users SET autoinside = ? WHERE username = ?")
        .run(Number(value), username);

      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  setBirthday(username, birthday = null) {
    try {
      if (this.getUser(username) === null && !this.addUser(username, ["default"])) return false; 

      this.db
        .prepare("UPDATE users SET birthday = ? WHERE username = ?")
        .run(birthday, username);

      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  removeUser(username) {
    try {
      this.db.prepare("DELETE FROM users WHERE username = ?").run(username);

      return true;
    } catch (error) {
      this.logger.error(error);
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
      this.logger.error(error);
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
      this.logger.error(error);
      return null;
    }
  }
}

module.exports = new UserRepository();
