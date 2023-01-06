require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const StatusRepository = require("./repositories/statusRepository");
const UsersRepository = require("./repositories/usersRepository");
const FundsRepository = require("./repositories/fundsRepository");
const TextGenerators = require("./services/textGenerators");
const UsersHelper = require("./services/usersHelper");
const ExportHelper = require("./services/export");
const Commands = require("./commands");
const { initGlobalModifiers, tag } = require("./global");

const TOKEN = process.env["HACKERBOTTOKEN"];
const IsDebug = process.env["BOTDEBUG"] === "true";
process.env.TZ = "Asia/Yerevan";

const bot = new TelegramBot(TOKEN, { polling: true });
initGlobalModifiers(bot);

bot.onText(/^\/(start|help)(@.+?)?$/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `🛠 Привет хакерчан. Я новый бот для менеджмента всяких процессов в спейсе. 
[Я еще нахожусь в разработке, ты можешь поучаствовать в моем развитии в репозитории на гитхабе спейса].
Держи мой список команд:\n` +
      UsersHelper.getAvailableCommands(msg.from.username) +
      `${Commands.GlobalModifiers}`
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

  if (accountants !== null) {
    accountantsList = accountants.reduce(
      (list, user) => `${list}${tag()}${user.username}\n`,
      ""
    );
  }

  bot.sendMessage(
    msg.chat.id,
    `Хакспейс не является коммерческим проектом и существует исключительно на пожертвования участников.
Мы вносим свой вклад в развитие хакспейса: оплата аренды и коммуналки, забота о пространстве, помощь в приобретении оборудования.
Мы будем рады любой поддержке. Задонатить нам можно с помощью банковской карты Visa/Mastercard Армении, крипты или налички при встрече.
По вопросам доната обращайтесь к нашему бухгалтеру.\n` + accountantsList
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
    insideText += `${tag()}${user.username}\n`;
  }
  bot.sendMessage(
    msg.chat.id,
    `🔐 Спейс ${stateText} юзером ${tag()}${state.changedby} 🔐
🗓 ${state.date.toLocaleString()}
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
    `🔑 Юзер ${tag()}${state.changedby} открыл спейс 🔑
🗓 ${state.date.toLocaleString()} `
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
    `🔓 Юзер ${tag()}${state.changedby} закрыл спейс 🔓
🗓 ${state.date.toLocaleString()}`
  );
});

bot.onText(/^\/in(@.+?)?$/, (msg) => {
  let eventDate = new Date();
  let gotIn = LetIn(msg.from.username, eventDate);
  let message = `🟢 Юзер ${tag()}${msg.from.username} пришел в спейс 🟢
  🗓 ${eventDate.toLocaleString()} `;

  if (!gotIn){
    message = "🔐 Откройте cпейс его прежде чем туда кого-то пускать! 🔐";
  }

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/inForce(@.+?)? (\S+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "member")) return;
  let username = match[2].replace("@", "");
  let eventDate = new Date();

  let gotIn = LetIn(username, eventDate);

  let message = `🟢 ${tag()}${
    msg.from.username
  } привёл юзера ${tag()}${username} в спейс  🟢
🗓 ${eventDate.toLocaleString()} `

  if (!gotIn){
    message = "🔐 Откройте cпейс прежде чем туда кого-то пускать! 🔐";
  }
  bot.sendMessage(msg.chat.id,message);
});

bot.onText(/^\/out(@.+?)?$/, (msg) => {
  let eventDate = new Date();
  let gotOut = LetOut(msg.from.username, eventDate);
  let message = `🔴 Юзер ${tag()}${msg.from.username} ушел из спейса 🔴
🗓 ${eventDate.toLocaleString()} `

  if (!gotOut){
    message = "🔐 Спейс же закрыт, как ты там оказался? Через окно залез? 🔐";
  }

  bot.sendMessage(msg.chat.id,message);
});

bot.onText(/^\/outForce(@.+?)? (\S+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "member")) return;
  let eventDate = new Date();
  let username = match[2].replace("@", "");
  let gotOut = LetOut(username, eventDate);

  let message = `🔴 ${tag()}${
    msg.from.username
  } выпроводил юзера ${tag()}${username} из спейса 🔴
🗓 ${eventDate.toLocaleString()} `;

  if (!gotOut){
    message = "🔐 А что тот делал в закрытом спейсе, ты его там запер? 🔐";
  }

  bot.sendMessage(msg.chat.id,message);
});

function LetIn(username, date) {
  // check that space is open
  let state = StatusRepository.getSpaceLastState();
  if (!state?.open) {
    return false;
  }

  let userstate = {
    inside: true,
    date: date,
    username: username,
  };

  StatusRepository.pushPeopleState(userstate);

  return true;
}

function LetOut(username, date) {
  let state = StatusRepository.getSpaceLastState();
  if (!state?.open) {
    return false;
  }

  let userstate = {
    inside: false,
    date: date,
    username: username,
  };

  StatusRepository.pushPeopleState(userstate);

  return true;
}

// User management
bot.onText(/^\/getUsers(@.+?)?$/, (msg, match) => {
  let users = UsersRepository.getUsers();

  let userList = "";

  for (const user of users) {
    userList += `${tag()}${user.username} ${user.roles}\n`;
  }

  bot.sendMessage(msg.chat.id, `Текущие пользователи:\n` + userList);
});

bot.onText(/^\/addUser(@.+?)? (\S+?) as (\S+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let username = match[2].replace("@", "");
  let roles = match[3].split("|");

  let success = UsersRepository.addUser(username, roles);
  let message = success
    ? `Пользователь ${tag()}${username} добавлен как ${roles}`
    : `Не удалось добаить пользователя (может он уже есть?)`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/updateRoles(@.+?)? of (\S+?) to (\S+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let username = match[2].replace("@", "");
  let roles = match[3].split("|");

  let success = UsersRepository.updateRoles(username, roles);
  let message = success
    ? `Роли ${tag()}${username} установлены как ${roles}`
    : `Не удалось обновить роли`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/removeUser(@.+?)? (\S+)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let username = match[2].replace("@", "");

  let success = UsersRepository.removeUser(username);
  let message = success
    ? `Пользователь ${tag()}${username} удален`
    : `Не удалось удалить пользователя (может его и не было?)`;

  bot.sendMessage(msg.chat.id, message);
});
//funds

bot.onText(/^\/funds(@.+?)?$/, async (msg) => {
  let funds = FundsRepository.getfunds().filter((p) => p.status === "open");
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
  let message = success ? `Удален сбор ${fundName}` : `Не удалось удалить сбор`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/exportFund(@.+?)? (.*\S)$/, async (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let fundName = match[2];

  let csvBuffer = await ExportHelper.exportFundToCSV(fundName);

  if (!csvBuffer?.length) {
    bot.sendMessage(msg.chat.id, "Нечего экспортировать");
    return;
  }

  const fileOptions = {
    filename: `${fundName} donations.csv`,
    contentType: "text/csv",
  };

  bot.sendDocument(msg.chat.id, csvBuffer, {}, fileOptions);
});

bot.onText(/^\/closeFund(@.+?)? (.*\S)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;
  let fundName = match[2];

  let success = FundsRepository.closefund(fundName);
  let message = success ? `Закрыт сбор ${fundName}` : `Не удалось закрыть сбор`;

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/^\/changeFundStatus(@.+?)? of (.*\S) to (.*\S)$/, (msg, match) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let fundName = match[2];
  let fundStatus = match[3].toLowerCase();

  let success = FundsRepository.changefundStatus(fundName, fundStatus);
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

    let success = FundsRepository.addDonationTo(fundName, userName, value);
    let message = success
      ? `Добавлен донат ${value}${currency} от ${tag()}${userName} в сбор ${fundName}`
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
