require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const StatusRepository = require("./repositories/statusRepository");
const UsersRepository = require("./repositories/usersRepository");
const ProjectsRepository = require("./repositories/projectsRepository");
const TextGenerators = require("./services/textGenerators");
const UsersHelper = require("./services/usersHelper");

const TOKEN = process.env["HACKERBOTTOKEN"];
const IsDebug = process.env["BOTDEBUG"] === "true";

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/^\/(start|help)/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🛠 Привет хакеровчанин. Держи мой список команд:\n" +
      UsersHelper.getAvailableCommands(msg.from.username)
  );
});

// State
bot.onText(/^\/state/, (msg) => {
  let state = StatusRepository.getSpaceLastState();

  if (!state) {
    bot.sendMessage(msg.chat.id, `🔐 Статус спейса неопределен 🔐`);
    return;
  }

  let inside = StatusRepository.getPeopleInside();

  let stateText = state.open ? "открыт" : "закрыт";
  let insideText =
    inside.length > 0
      ? "👨‍💻 Внутри отметились:\n"
      : "🛌 Внутри никто не отметился\n";
  for (const user of inside) {
    insideText += `@${user.username}\n`;
  }
  bot.sendMessage(
    msg.chat.id,
    `🔐 Спейс ${stateText} юзером @${state.changedby} 🔐
🗓 Дата изменения: ${state.date.toLocaleString()}
` + insideText
  );
});

bot.onText(/^\/open/, (msg) => {
  let state = {
    open: true,
    date: new Date(),
    changedby: msg.from.username,
  };

  StatusRepository.pushSpaceState(state);

  bot.sendMessage(
    msg.chat.id,
    `🔑 Юзер @${state.changedby} открыл спейс 🔑
🗓 Дата изменения: ${state.date.toLocaleString()} `
  );
});

bot.onText(/^\/close/, (msg) => {
  let state = {
    open: false,
    date: new Date(),
    changedby: msg.from.username,
  };

  StatusRepository.pushSpaceState(state);
  StatusRepository.evictPeople();

  bot.sendMessage(
    msg.chat.id,
    `🔓 Юзер @${state.changedby} закрыл спейс 🔓
🗓 Дата изменения: ${state.date.toLocaleString()}`
  );
});

bot.onText(/^\/in/, (msg) => {
  let userstate = {
    inside: true,
    date: new Date(),
    username: msg.from.username,
  };

  StatusRepository.pushPeopleState(userstate);

  bot.sendMessage(
    msg.chat.id,
    `🟢 Юзер @${userstate.username} пришел в спейс 🟢
🗓 Дата изменения: ${userstate.date.toLocaleString()} `
  );
});

bot.onText(/^\/out/, (msg) => {
  let userstate = {
    inside: false,
    date: new Date(),
    username: msg.from.username,
  };

  StatusRepository.pushPeopleState(userstate);

  bot.sendMessage(
    msg.chat.id,
    `🔴 Юзер @${userstate.username} ушел из спейса 🔴
🗓 Дата изменения: ${userstate.date.toLocaleString()} `
  );
});

// User management
bot.onText(/^\/getUsers/, (msg, match) => {
  let users = UsersRepository.getUsers();

  let userList = "";

  for (const user of users) {
    userList += `${user.username} ${user.roles}\n`;
  }

  bot.sendMessage(msg.chat.id, `Текущие пользователи:\n` + userList);
});

bot.onText(/^\/addUser (.+?) as (.+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let username = match[1].replace("@", "");
  let roles = match[2].split("|");

  let success = UsersRepository.addUser(username, roles);
  let message = success
    ? `Пользователь @${username} добавлен как ${roles}`
    : `Не удалось добаить пользователя (может он уже есть?)`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/updateRoles of (.+?) to (.+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let username = match[1].replace("@", "");
  let roles = match[2].split("|");

  let success = UsersRepository.updateRoles(username, roles);
  let message = success
    ? `Роли @${username} установлены как ${roles}`
    : `Не удалось обновить роли`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/removeUser (.+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let username = match[1].replace("@", "");

  let success = UsersRepository.removeUser(username);
  let message = success
    ? `Пользователь @${username} удален`
    : `Не удалось удалить пользователя (может его и не было?)`;

  bot.sendMessage(msg.chat.id, message);
});
//Projects

bot.onText(/^\/projects/, async (msg) => {
  let projects = ProjectsRepository.getProjects().filter(
    (p) => p.status === "open"
  );
  let donations = ProjectsRepository.getDonations();

  let list = await TextGenerators.createProjectList(projects, donations);

  bot.sendMessage(msg.chat.id, "⚒ Вот наши текущие проекты:\n\n" + list);
});

bot.onText(/^\/projectsAll/, async (msg) => {
  let projects = ProjectsRepository.getProjects();
  let donations = ProjectsRepository.getDonations();

  let list = await TextGenerators.createProjectList(projects, donations);

  bot.sendMessage(msg.chat.id, "⚒ Вот все наши проекты:\n\n" + list);
});

bot.onText(/^\/addProject (.+) with target (\d+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let projectName = match[1];
  let targetValue = match[2];

  ProjectsRepository.addProject(projectName, targetValue);

  bot.sendMessage(msg.chat.id, `Добавлен проект ${projectName}`);
});

bot.onText(/^\/removeProject (.+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let projectName = match[1];

  let success = ProjectsRepository.removeProject(projectName);
  let message = success
    ? `Удален проект ${projectName}`
    : `Не удалось удалить проект`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/closeProject (.+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;
  let projectName = match[1];

  let success = ProjectsRepository.closeProject(projectName);
  let message = success
    ? `Закрыт проект ${projectName}`
    : `Не удалось закрыть проект`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/changeProjectStatus of (.+?) to (.+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let projectName = match[1];
  let projectStatus = match[2].toLowerCase();

  let success = ProjectsRepository.changeProjectStatus(
    projectName,
    projectStatus
  );
  let message = success
    ? `Статус проекта ${projectName} изменен на ${projectStatus}`
    : `Не удалось изменить статус проекта`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(
  /^\/addDonation (\d+?)(\D*?) from (.+?) to (.+)$/,
  async (msg, match) => {
    if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

    let value = match[1];
    let currency = match[2];
    let userName = match[3].replace("@", "");
    let projectName = match[4];

    let success = ProjectsRepository.addDonationTo(
      projectName,
      userName,
      value
    );
    let message = success
      ? `Добавлен донат ${value} ${currency} от ${userName} в проект ${projectName}`
      : `Не удалось добавить донат`;

    bot.sendMessage(msg.chat.id, message);
  }
);

bot.onText(/^\/removeDonation (.+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

  let donationId = match[1];

  let success = ProjectsRepository.removeDonationById(donationId);
  let message = success
    ? `Удален донат ${donationId}`
    : `Не удалось удалить донат (может его и не было?)`;

  bot.sendMessage(msg.chat.id, message);
});

// Debug echoing of received messages
IsDebug &&
  bot.on("message", (msg) => {
    bot.sendMessage(
      msg.chat.id,
      `Debug: Received from ${msg.chat.id} message ${msg.text}`
    );
  });
