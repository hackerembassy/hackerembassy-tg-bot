const UsersRepository = require("../../repositories/usersRepository");
const TextGenerators = require("../../services/textGenerators");
const BaseHandlers = require("./base");

class BirthdayHandlers extends BaseHandlers {
  constructor() {
    super();
  }

  birthdayHandler = (msg) => {
    let birthdayUsers = UsersRepository.getUsers().filter((u) => u.birthday);
    let message = TextGenerators.getBirthdaysList(birthdayUsers, this.tag());

    this.bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
  };

  myBirthdayHandler = (msg, date) => {
    let message = `Укажите дату в формате \`YYYY-MM-DD\` или укажите \`remove\``;
    let username = msg.from.username;

    if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2]\d|3[0-1])$/.test(date)) {
      if (UsersRepository.setBirthday(username, date))
        message = `🎂 День рождения ${this.tag()}${TextGenerators.excapeUnderscore(username)} установлен как ${date}`;
    } else if (date === "remove") {
      if (UsersRepository.setBirthday(username, null))
        message = `🎂 День рождения ${this.tag()}${TextGenerators.excapeUnderscore(username)} сброшен`;
    }

    this.bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
  };
}

module.exports = BirthdayHandlers;
