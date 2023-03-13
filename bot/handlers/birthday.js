const UsersRepository = require("../../repositories/usersRepository");
const TextGenerators = require("../../services/textGenerators");
const BaseHandlers = require("./base");
const UsersHelper = require("../../services/usersHelper");

class BirthdayHandlers extends BaseHandlers {
  constructor() {
    super();
  }

  forceBirthdayWishHandler = (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

    this.bot.sendBirthdayWishes(true);
  };

  birthdayHandler = (msg) => {
    let birthdayUsers = UsersRepository.getUsers().filter((u) => u.birthday);
    let message = TextGenerators.getBirthdaysList(birthdayUsers);

    this.bot.sendMessage(msg.chat.id, message);
  };

  myBirthdayHandler = (msg, date) => {
    let message = `🛂 Укажите дату в формате #\`YYYY-MM-DD#\`, #\`MM-DD#\` или укажите #\`remove#\``;
    let username = msg.from.username;

    if (/^(?:\d{4}\-)?(0[1-9]|1[0-2])-(0[1-9]|[1-2]\d|3[0-1])$/.test(date)) {
      let fulldate = date.length === 5 ? "0000-" + date : date;
      if (UsersRepository.setBirthday(username, fulldate))
        message = `🎂 День рождения ${this.bot.formatUsername(username)} установлен как ${date}`;
    } else if (date === "remove") {
      if (UsersRepository.setBirthday(username, null))
        message = `🎂 День рождения ${this.bot.formatUsername(username)} сброшен`;
    }

    this.bot.sendMessage(msg.chat.id, message);
  };
}

module.exports = BirthdayHandlers;
