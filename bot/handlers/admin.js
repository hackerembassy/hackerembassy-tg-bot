const UsersRepository = require("../../repositories/usersRepository");
const UsersHelper = require("../../services/usersHelper");
const BaseHandlers = require("./base");

class AdminHandlers extends BaseHandlers {
  constructor(){
    super();
  }
  
  getUsersHandler = (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

    let users = UsersRepository.getUsers();
    let userList = "";
    for (const user of users) {
      userList += `${this.bot.formatUsername(user.username)} \n    Roles: ${user.roles}${user.mac? `\n    MAC: ${user.mac}`:""}${user.birthday? `\n    Birthday: ${user.birthday}`:""}\n`;
    }

    this.bot.sendLongMessage(msg.chat.id, `Текущие пользователи:\n` + userList);
  }

  addUserHandler = (msg, username, roles) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

    username = username.replace("@", "");
    roles = roles.split("|");

    let success = UsersRepository.addUser(username, roles);
    let message = success
      ? `Пользователь ${this.bot.formatUsername(username)} добавлен как ${roles}`
      : `Не удалось добавить пользователя (может он уже есть?)`;

    this.bot.sendMessage(msg.chat.id, message);
  }

  updateRolesHandler = (msg, username, roles) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

    username = username.replace("@", "");
    roles = roles.split("|");

    let success = UsersRepository.updateRoles(username, roles);
    let message = success ? `Роли ${this.bot.formatUsername(username)} установлены как ${roles}` : `Не удалось обновить роли`;

    this.bot.sendMessage(msg.chat.id, message);
  }

  removeUserHandler = (msg, username) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

    username = username.replace("@", "");

    let success = UsersRepository.removeUser(username);
    let message = success
      ? `Пользователь ${this.bot.formatUsername(username)} удален`
      : `Не удалось удалить пользователя (может его и не было?)`;

    this.bot.sendMessage(msg.chat.id, message);
  }
}

module.exports = AdminHandlers;
