require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const StatusRepository = require("./repositories/statusRepository");
const UsersRepository = require("./repositories/usersRepository");
const FundsRepository = require("./repositories/fundsRepository");
const TextGenerators = require("./services/textGenerators");
const UsersHelper = require("./services/usersHelper");

const TOKEN = process.env["HACKERBOTTOKEN"];
const IsDebug = process.env["BOTDEBUG"] === "true";
process.env.TZ = "Asia/Yerevan";

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/^\/(start|help)(@.+?)?$/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `🛠 Привет хакерчан. Я новый бот для менеджмента всяких процессов в спейсе. 
[Я еще нахожусь в разработке, ты можешь поучаствовать в моем развитии в репозитории на гитхабе спейса].
Держи мой список команд:\n` +
      UsersHelper.getAvailableCommands(msg.from.username)
  );
});

bot.onText(/^\/(about)(@.+?)?$/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Hacker Embassy (Ереванский Хакспейс) - это пространство, где собираются единомышленники, увлеченные технологиями и творчеством.
Мы вместе работаем над проектами, делимся идеями и знаниями, просто общаемся.
Ты можешь почитать о нас подробнее на нашем сайте https://hackerembassy.site/
Мы всегда рады новым резидентам :)`
  );
});

bot.onText(/^\/(donate)(@.+?)?$/, (msg) => {
  let accountants = UsersRepository.getUsersByRole("accountant");
  let accountantsList = "";

  if (accountants!==null){
    accountantsList = accountants.reduce((list, user)=> `${list}@${user.username}\n`, "");
  }

  bot.sendMessage(
    msg.chat.id,
    `Хакспейс не является коммерческим проектом и существует исключительно на пожертвования участников.
Мы вносим свой вклад в развитие хакспейса: оплата аренды и коммуналки, забота о пространстве, помощь в приобретении оборудования.
Мы будем рады любой поддержке. Задонатить нам можно с помощью банковской карты Visa/Mastercard Армении, крипты или налички при встрече.
По вопросам доната обращайтесь к нашему бухгалтеру.\n`+accountantsList
  );
});

// State
bot.onText(/^\/status(@.+?)?$/, (msg) => {
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

bot.onText(/^\/open(@.+?)?$/, (msg) => {
  if (!UsersHelper.hasRole(msg.from.username, "member")) return;
  let opendate = new Date();
  let state = {
    open: true,
    date: opendate,
    changedby: msg.from.username,
  };

  StatusRepository.pushSpaceState(state);

  let userstate = {
    inside: true,
    date: opendate,
    username: msg.from.username,
  };

  StatusRepository.pushPeopleState(userstate);

  bot.sendMessage(
    msg.chat.id,
    `🔑 Юзер @${state.changedby} открыл спейс 🔑
🗓 Дата изменения: ${state.date.toLocaleString()} `
  );
});

bot.onText(/^\/close(@.+?)?$/, (msg) => {
  if (!UsersHelper.hasRole(msg.from.username, "member")) return;
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

bot.onText(/^\/in(@.+?)?$/, (msg) => {
  // check that space is open
  let state = StatusRepository.getSpaceLastState();
  if (!state?.open) {
    let message = !state ? 
      "🔐 Статус спейса не определен, откройте его прежде чем входить! 🔐" : 
      "🔐 Спейс закрыт, откройте его прежде чем входить! 🔐";
    bot.sendMessage(msg.chat.id, message);
    return;
  }
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

bot.onText(/^\/out(@.+?)?$/, (msg) => {
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
bot.onText(/^\/getUsers(@.+?)?$/, (msg, match) => {
  let users = UsersRepository.getUsers();

  let userList = "";

  for (const user of users) {
    userList += `@${user.username} ${user.roles}\n`;
  }

  bot.sendMessage(msg.chat.id, `Текущие пользователи:\n` + userList);
});

bot.onText(/^\/addUser(@.+?)? (\S+?) as (\S+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let username = match[2].replace("@", "");
  let roles = match[3].split("|");

  let success = UsersRepository.addUser(username, roles);
  let message = success
    ? `Пользователь @${username} добавлен как ${roles}`
    : `Не удалось добаить пользователя (может он уже есть?)`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/updateRoles(@.+?)? of (\S+?) to (\S+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let username = match[2].replace("@", "");
  let roles = match[3].split("|");

  let success = UsersRepository.updateRoles(username, roles);
  let message = success
    ? `Роли @${username} установлены как ${roles}`
    : `Не удалось обновить роли`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/removeUser(@.+?)? (\S+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let username = match[2].replace("@", "");

  let success = UsersRepository.removeUser(username);
  let message = success
    ? `Пользователь @${username} удален`
    : `Не удалось удалить пользователя (может его и не было?)`;

  bot.sendMessage(msg.chat.id, message);
});
//funds

bot.onText(/^\/funds(@.+?)?$/, async (msg) => {
  let funds = FundsRepository.getfunds().filter(
    (p) => p.status === "open"
  );
  let donations = FundsRepository.getDonations();

  let list = await TextGenerators.createFundList(funds, donations);

  bot.sendMessage(msg.chat.id, "⚒ Вот наши текущие сборы:\n\n" + list);
});

bot.onText(/^\/fundsAll(@.+?)?$/, async (msg) => {
  let funds = FundsRepository.getfunds();
  let donations = FundsRepository.getDonations();

  let list = await TextGenerators.createFundList(funds, donations);

  bot.sendMessage(msg.chat.id, "⚒ Вот все наши сборы:\n\n" + list);
});

bot.onText(/^\/addFund(@.+?)? (.*\S) with target (\d+)(\D*)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let fundName = match[2];
  let targetValue = match[3];

  let success = FundsRepository.addfund(fundName, targetValue);
  let message = success
    ? `Добавлен сбор ${fundName} с целью в ${targetValue} AMD`
    : `Не удалось добавить сбор (может он уже есть?)`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/removeFund(@.+?)? (.*\S)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let fundName = match[2];

  let success = FundsRepository.removefund(fundName);
  let message = success
    ? `Удален сбор ${fundName}`
    : `Не удалось удалить сбор`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/closeFund(@.+?)? (.*\S)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;
  let fundName = match[2];

  let success = FundsRepository.closefund(fundName);
  let message = success
    ? `Закрыт сбор ${fundName}`
    : `Не удалось закрыть сбор`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/changeFundStatus(@.+?)? of (.*\S) to (.*\S)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let fundName = match[2];
  let fundStatus = match[3].toLowerCase();

  let success = FundsRepository.changefundStatus(
    fundName,
    fundStatus
  );
  let message = success
    ? `Статус сбора ${fundName} изменен на ${fundStatus}`
    : `Не удалось изменить статус сбора`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(
  /^\/addDonation(@.+?)? (\d+?)(\D*?) from (\S+?) to (.*\S)$/,
  async (msg, match) => {
    if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

    let value = match[2];
    let currency = match[3];
    let userName = match[4].replace("@", "");
    let fundName = match[5];

    let success = FundsRepository.addDonationTo(
      fundName,
      userName,
      value
    );
    let message = success
      ? `Добавлен донат ${value}${currency} от @${userName} в сбор ${fundName}`
      : `Не удалось добавить донат`;

    bot.sendMessage(msg.chat.id, message);
  }
);

bot.onText(/^\/removeDonation(@.+?)? (\d+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

  let donationId = match[2];

  let success = FundsRepository.removeDonationById(donationId);
  let message = success
    ? `Удален донат [id:${donationId}]`
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
