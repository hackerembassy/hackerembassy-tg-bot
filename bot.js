require("dotenv").config();
require("./api");
require("./services/autoInOut");
const TelegramBot = require("node-telegram-bot-api");
const StatusRepository = require("./repositories/statusRepository");
const UsersRepository = require("./repositories/usersRepository");
const FundsRepository = require("./repositories/fundsRepository");
const NeedsRepository = require("./repositories/needsRepository");
const TextGenerators = require("./services/textGenerators");
const UsersHelper = require("./services/usersHelper");
const ExportHelper = require("./services/export");
const Commands = require("./commands");
const CoinsHelper = require("./data/coins/coins");
const config = require("config");
const botConfig = config.get("bot");
const embassyApiConfig = config.get("embassy-api");
const currencyConfig = config.get("currency");
const {
  initGlobalModifiers,
  addLongCommands,
  addSavingLastMessages,
  disableNotificationsByDefault,
  tag,
  needCommands,
  popLast,
  enableAutoWishes
} = require("./botExtensions");
const fetch = require("node-fetch");

function parseMoneyValue(value) {
  return Number(
    value.replaceAll(/(k|тыс|тысяч|т)/g, "000").replaceAll(",", "")
  );
}

const TOKEN = process.env["HACKERBOTTOKEN"];
const CALLBACK_DATA_RESTRICTION = 20;
const IsDebug = process.env["BOTDEBUG"] === "true";
process.env.TZ = botConfig.timezone;

const bot = new TelegramBot(TOKEN, { polling: true });

// Apply extensions to the bot
addLongCommands(bot);
initGlobalModifiers(bot);
addSavingLastMessages(bot);
disableNotificationsByDefault(bot);
if (botConfig.autoWish) enableAutoWishes(bot);

function fromPrivateChat(msg) {
  return msg?.chat.type === "private";
}

let exportDonutHandler = async (msg, fundName) => {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let imageBuffer;
  try {
    imageBuffer = await ExportHelper.exportFundToDonut(fundName);
  } catch (error) {
    bot.sendMessage(msg.chat.id, "Что-то не так");
    return;
  }

  if (!imageBuffer?.length) {
    bot.sendMessage(msg.chat.id, "Нечего экспортировать");
    return;
  }

  bot.sendPhoto(msg.chat.id, imageBuffer);
};

async function printerHandler (msg) {
  let message = TextGenerators.getPrinterInfo();
  bot.sendMessage(msg.chat.id, message);
}

async function printerStatusHandler(msg) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    var {status, thumbnailBuffer} = await (await fetch(`${embassyApiConfig.host}:${embassyApiConfig.port}/printer`, { signal: controller.signal }))?.json();
    clearTimeout(timeoutId);

    if (status && !status.error)
      var message = await TextGenerators.getPrinterStatus(status);
    else 
      throw Error();
  }
  catch {
    message = `⚠️ Принтер пока недоступен`;
  } 
  finally {
    if (thumbnailBuffer) 
      bot.sendPhoto(msg.chat.id, Buffer.from(thumbnailBuffer), { caption: message });
    else 
      bot.sendMessage(msg.chat.id, message);
  }
}



function autoinsideHandler(msg, mac){
  let message = `Укажите валидный MAC адрес`;
  let username = msg.from.username;

  if (!mac || mac === "help"){
    message = `⏲ С помощью этой команды можно автоматически отмечаться в спейсе как только MAC адрес вашего устройства будет обнаружен в сети.
📌 При отсутствии активности устройства в сети спейса в течение ${botConfig.timeouts.out/60000} минут произойдет автовыход юзера.
📌 При включенной фиче актуальный статус устройства в сети имеет приоритет над ручными командами входа/выхода.
⚠️ Для работы обязательно отключите рандомизацию MAC адреса для сети спейса.

\`/autoinside mac_address\` - Включить автовход и автовыход  
\`/autoinside status\` - Статус автовхода и автовыхода  
\`/autoinside disable\` - Выключить автовход и автовыход  
`
  } else if (mac && /([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})/.test(mac) && UsersRepository.setMAC(username, mac)){
    message = `Автовход и автовыход активированы для юзера ${tag()}${TextGenerators.excapeUnderscore(username)} на MAC адрес ${mac}.
Не забудьте отключить рандомизацию MAC адреса для сети спейса
`
  } else if (mac === "disable"){
    UsersRepository.setMAC(username, null);
    message = `Автовход и автовыход выключены для юзера ${tag()}${TextGenerators.excapeUnderscore(username)}`
  } else if (mac === "status"){
    let usermac = UsersRepository.getUser(username)?.mac;
    if (usermac)
      message = `Автовход и автовыход включены для юзера ${tag()}${TextGenerators.excapeUnderscore(username)} на MAC адрес ${usermac}`
    else
      message = `Автовход и автовыход выключены для юзера ${tag()}${TextGenerators.excapeUnderscore(username)}`
  }

  bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
}

function startHandler(msg) {
  bot.sendMessage(
    msg.chat.id,
    `🛠 Привет хакерчан. Я новый бот для менеджмента всяких процессов в спейсе. 
[Я еще нахожусь в разработке, ты можешь поучаствовать в моем развитии в репозитории на гитхабе спейса].
Держи мой список команд:\n` +
      UsersHelper.getAvailableCommands(msg.from.username) +
      `${Commands.GlobalModifiers}`,
    { parse_mode: "Markdown" }
  );
}

function aboutHandler(msg) {
  bot.sendMessage(
    msg.chat.id,
    `🏫 Hacker Embassy (Ереванский Хакспейс) - это пространство, где собираются единомышленники, увлеченные технологиями и творчеством. Мы вместе работаем над проектами, делимся идеями и знаниями, просто общаемся.

💻 Ты можешь почитать о нас подробнее на нашем сайте https://hackerembassy.site/

🍕 Мы всегда рады новым резидентам. Хочешь узнать, как стать участником? Жми команду /join`
  );
}

function joinHandler(msg){
  let message = TextGenerators.getJoinText();
  bot.sendMessage(msg.chat.id, message);
}

function donateHandler(msg){
  let accountants = UsersRepository.getUsersByRole("accountant");
  let message = TextGenerators.getDonateText(accountants, tag());
  bot.sendMessage(msg.chat.id, message);
}

function locationHandler(msg) {
  let message = `🗺 Наш адрес: Армения, Ереван, Пушкина 38 (вход со двора)`;
  bot.sendMessage(msg.chat.id, message);
  bot.sendLocation(msg.chat.id, 40.18258, 44.51338);
  bot.sendPhoto(msg.chat.id, "./images/house.jpg", {
    caption: `🏫 Вот этот домик, единственный в своем роде`,
  });
}

async function newMemberHandler(msg) {
  let botName = (await bot.getMe()).username;
  let newMembers = msg.new_chat_members.reduce(
    (res, member) => res + `${tag()}${member.username} `,
    ""
  );
  let message = `🇬🇧 Добро пожаловать в наш уютный уголок, ${newMembers}

Я @${botName}, бот-менеджер хакерспейса. Ко мне в личку можно зайти пообщаться, вбить мои команды, и я расскажу вкратце о нас.
🎉🎉🎉 Хакерчане, приветствуем ${newMembers}`;
  bot.sendMessage(msg.chat.id, message);
}

function statusHandler(msg) {
  let state = StatusRepository.getSpaceLastState();

  if (!state) {
    bot.sendMessage(msg.chat.id, `🔐 Статус спейса неопределен`);
    return;
  }

  let inside = StatusRepository.getPeopleInside();

  let statusMessage = TextGenerators.getStatusMessage(state, inside, tag());
  let inlineKeyboard = state.open
    ? [
        [
          {
            text: "Я пришёл в спейс",
            callback_data: JSON.stringify({ command: "/in" }),
          },
          {
            text: "Я ушёл из спейса",
            callback_data: JSON.stringify({ command: "/out" }),
          },
        ],
        [
          {
            text: "Повторить команду",
            callback_data: JSON.stringify({ command: "/status" }),
          },
          {
            text: "Закрыть спейс",
            callback_data: JSON.stringify({ command: "/close" }),
          },
        ],
      ]
    : [
        [
          {
            text: "Повторить команду",
            callback_data: JSON.stringify({ command: "/status" }),
          },
          {
            text: "Открыть спейс",
            callback_data: JSON.stringify({ command: "/open" }),
          },
        ],
      ];

  bot.sendMessage(msg.chat.id, statusMessage, {
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  });
};

function openHandler (msg){
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

  let inlineKeyboard = [
    [
      {
        text: "Я тоже пришёл",
        callback_data: JSON.stringify({ command: "/in" }),
      },
      {
        text: "Закрыть снова",
        callback_data: JSON.stringify({ command: "/close" }),
      },
    ],
    [
      {
        text: "Кто внутри",
        callback_data: JSON.stringify({ command: "/status" }),
      },
    ],
  ];

  bot.sendMessage(
    msg.chat.id,
    `🔓 ${tag()}${state.changedby} открыл спейс
Отличный повод зайти

🗓 ${state.date.toLocaleString()} `,
    {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    }
  );
};

function closeHandler(msg) {
  if (!UsersHelper.hasRole(msg.from.username, "member")) return;

  let state = {
    open: false,
    date: new Date(),
    changedby: msg.from.username,
  };

  StatusRepository.pushSpaceState(state);
  StatusRepository.evictPeople();

  let inlineKeyboard = [
    [
      {
        text: "Открыть снова",
        callback_data: JSON.stringify({ command: "/open" }),
      },
    ],
  ];

  bot.sendMessage(
    msg.chat.id,
    `🔒 ${tag()}${state.changedby} закрыл спейс
Все отметившиеся отправлены домой

🗓 ${state.date.toLocaleString()}`,
    {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    }
  );
};

function inHandler(msg){
  let eventDate = new Date();
  let user = msg.from.username ?? msg.from.first_name;
  let gotIn = LetIn(user, eventDate);
  let message = `🟢 ${tag()}${user} пришел в спейс
🗓 ${eventDate.toLocaleString()} `;

  if (!gotIn) {
    message = "🔐 Откройте cпейс прежде чем туда входить!";
  }

  let inlineKeyboard = gotIn
    ? [
        [
          {
            text: "Я тоже пришёл",
            callback_data: JSON.stringify({ command: "/in" }),
          },
          {
            text: "А я уже ушёл",
            callback_data: JSON.stringify({ command: "/out" }),
          },
        ],
        [
          {
            text: "Кто внутри",
            callback_data: JSON.stringify({ command: "/status" }),
          },
        ],
      ]
    : [
        [
          {
            text: "Повторить команду",
            callback_data: JSON.stringify({ command: "/in" }),
          },
          {
            text: "Открыть спейс",
            callback_data: JSON.stringify({ command: "/open" }),
          },
        ],
      ];

  bot.sendMessage(msg.chat.id, message, {
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  });
};

function outHandler (msg) {
  let eventDate = new Date();
  let gotOut = LetOut(msg.from.username, eventDate);
  let message = `🔴 ${tag()}${msg.from.username} ушел из спейса
🗓 ${eventDate.toLocaleString()} `;

  if (!gotOut) {
    message = "🔐 Спейс же закрыт, как ты там оказался? Через окно залез?";
  }

  let inlineKeyboard = gotOut
    ? [
        [
          {
            text: "Я тоже ушёл",
            callback_data: JSON.stringify({ command: "/out" }),
          },
          {
            text: "А я пришёл",
            callback_data: JSON.stringify({ command: "/in" }),
          },
        ],
        [
          {
            text: "Кто внутри",
            callback_data: JSON.stringify({ command: "/status" }),
          },
        ],
      ]
    : [
        [
          {
            text: "Повторить команду",
            callback_data: JSON.stringify({ command: "/out" }),
          },
          {
            text: "Открыть спейс",
            callback_data: JSON.stringify({ command: "/open" }),
          },
        ],
      ];

  bot.sendMessage(msg.chat.id, message, {
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  });
};

function inForceHandler(msg, match) {
  if (!UsersHelper.hasRole(msg.from.username, "member")) return;
  let username = match[2].replace("@", "");
  let eventDate = new Date();

  let gotIn = LetIn(username, eventDate);

  let message = `🟢 ${tag()}${
    msg.from.username
  } привёл ${tag()}${username} в спейс 
🗓 ${eventDate.toLocaleString()} `;

  if (!gotIn) {
    message = "🔐 Откройте cпейс прежде чем туда кого-то пускать!";
  }
  bot.sendMessage(msg.chat.id, message);
}

function outForceHandler(msg, match){
  if (!UsersHelper.hasRole(msg.from.username, "member")) return;
  let eventDate = new Date();
  let username = match[2].replace("@", "");
  let gotOut = LetOut(username, eventDate);

  let message = `🔴 ${tag()}${
    msg.from.username
  } отправил домой ${tag()}${username}
🗓 ${eventDate.toLocaleString()} `;

  if (!gotOut) {
    message = "🔐 А что тот делал в закрытом спейсе, ты его там запер?";
  }

  bot.sendMessage(msg.chat.id, message);
}

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

// Happy birthday

function birthdayHandler(msg) {
  let birthdayUsers = UsersRepository.getUsers().filter(u=>u.birthday);
  let message = TextGenerators.getBirthdaysList(birthdayUsers, tag());

  bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
}

function myBirthdayHandler(msg, date) {
  let message = `Укажите дату в формате \`YYYY-MM-DD\` или укажите \`remove\``;
  let username = msg.from.username;

  if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2]\d|3[0-1])$/.test(date)){
    if (UsersRepository.setBirthday(username, date))
      message = `🎂 День рождения ${tag()}${TextGenerators.excapeUnderscore(username)} установлен как ${date}`;
  } else if (date === "remove") {
    if (UsersRepository.setBirthday(username, null))
      message = `🎂 День рождения ${tag()}${TextGenerators.excapeUnderscore(username)} сброшен`;
  }

  bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
}


function needsHandler(msg) {
  let needs = NeedsRepository.getOpenNeeds();
  let message = TextGenerators.getNeedsList(needs, tag());

  bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
}

function buyHandler(msg, match) {
  let text = match[2];
  let requester = msg.from.username;

  NeedsRepository.addBuy(text, requester, new Date());

  let message = `🙏 ${tag()}${TextGenerators.excapeUnderscore(
    requester
  )} попросил кого-нибудь купить \`${text}\` по дороге в спейс.`;

  bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
}

function boughtHandler(msg, match) {
  let text = match[2];
  let buyer = msg.from.username;

  let need = NeedsRepository.getOpenNeedByText(text);

  if (!need || need.buyer) {
    bot.sendMessage(
      msg.chat.id,
      `🙄 Открытого запроса на покупку с таким именем не нашлось`
    );
    return;
  }

  let message = `✅ ${tag()}${TextGenerators.excapeUnderscore(
    buyer
  )} купил \`${text}\` в спейс`;

  NeedsRepository.closeNeed(text, buyer, new Date());

  bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
}

function getUsersHandler(msg){
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let users = UsersRepository.getUsers();
  let userList = "";
  for (const user of users) {
    userList += `${tag()}${user.username} ${user.roles}\n`;
  }

  bot.sendMessage(msg.chat.id, `Текущие пользователи:\n` + userList);
}

function addUserHandler(msg, match) {
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let username = match[2].replace("@", "");
  let roles = match[3].split("|");

  let success = UsersRepository.addUser(username, roles);
  let message = success
    ? `Пользователь ${tag()}${username} добавлен как ${roles}`
    : `Не удалось добавить пользователя (может он уже есть?)`;

  bot.sendMessage(msg.chat.id, message);
}


function updateRolesHandler(msg, match) {
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let username = match[2].replace("@", "");
  let roles = match[3].split("|");

  let success = UsersRepository.updateRoles(username, roles);
  let message = success
    ? `Роли ${tag()}${username} установлены как ${roles}`
    : `Не удалось обновить роли`;

  bot.sendMessage(msg.chat.id, message);
}


function removeUserHandler(msg, match) {
  if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

  let username = match[2].replace("@", "");

  let success = UsersRepository.removeUser(username);
  let message = success
    ? `Пользователь ${tag()}${username} удален`
    : `Не удалось удалить пользователя (может его и не было?)`;

  bot.sendMessage(msg.chat.id, message);
}

async function fundsHandler (msg) {
  let funds = FundsRepository.getfunds().filter((p) => p.status === "open");
  let donations = FundsRepository.getDonations();
  let addCommands =
    needCommands() && fromPrivateChat(msg)
      ? UsersHelper.hasRole(msg.from.username, "admin", "accountant")
      : false;

  let list = await TextGenerators.createFundList(
    funds,
    donations,
    addCommands,
    tag()
  );

  let message = `⚒ Вот наши текущие сборы:

  ${list}💸 Чтобы узнать, как нам помочь - жми /donate`;

  bot.sendLongMessage(msg.chat.id, message, { parse_mode: "Markdown" });
}
//funds


async function fundHandler (msg, match) {
  let fundName = match[2];
  let funds = [FundsRepository.getfundByName(fundName)];
  let donations = FundsRepository.getDonationsForName(fundName);
  let addCommands =
    needCommands() && fromPrivateChat(msg)
      ? UsersHelper.hasRole(msg.from.username, "admin", "accountant")
      : false;

  // telegram callback_data is restricted to 64 bytes
  let inlineKeyboard =
    fundName.length < CALLBACK_DATA_RESTRICTION
      ? [
          [
            {
              text: "Экспортнуть в CSV",
              callback_data: JSON.stringify({
                command: "/ef",
                params: [fundName],
              }),
            },
            {
              text: "Посмотреть диаграмму",
              callback_data: JSON.stringify({
                command: "/ed",
                params: [fundName],
              }),
            },
          ],
        ]
      : [];

  let list = await TextGenerators.createFundList(
    funds,
    donations,
    addCommands,
    tag()
  );

  let message = `${list}💸 Чтобы узнать, как нам помочь - жми /donate`;

  bot.sendMessage(msg.chat.id, message, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  });
}

async function fundsallHandler(msg) {
  let funds = FundsRepository.getfunds();
  let donations = FundsRepository.getDonations();
  let addCommands =
    needCommands() && fromPrivateChat(msg)
      ? UsersHelper.hasRole(msg.from.username, "admin", "accountant")
      : false;
  let list = await TextGenerators.createFundList(
    funds,
    donations,
    addCommands,
    tag()
  );

  bot.sendLongMessage(msg.chat.id, "⚒ Вот все наши сборы:\n\n" + list, {
    parse_mode: "Markdown",
  });
}

function addFundHandler (msg, match) {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let fundName = match[2];
  let targetValue = parseMoneyValue(match[3]);
  let currency =
    match[4]?.length > 0 ? match[4].toUpperCase() : currencyConfig.default;

  let success =
    !isNaN(targetValue) &&
    FundsRepository.addfund(fundName, targetValue, currency);
  let message = success
    ? `Добавлен сбор ${fundName} с целью в ${targetValue} ${currency}`
    : `Не удалось добавить сбор (может он уже есть?)`;

  bot.sendMessage(msg.chat.id, message);
}

function updateFundHandler(msg, match){
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let fundName = match[2];
  let targetValue = parseMoneyValue(match[3]);
  let currency =
    match[4]?.length > 0 ? match[4].toUpperCase() : currencyConfig.default;
  let newFundName = match[5]?.length > 0 ? match[5] : fundName;

  let success =
    !isNaN(targetValue) &&
    FundsRepository.updatefund(fundName, targetValue, currency, newFundName);
  let message = success
    ? `Обновлен сбор ${fundName} с новой целью в ${targetValue} ${currency}`
    : `Не удалось обновить сбор (может не то имя?)`;

  bot.sendMessage(msg.chat.id, message);
}

function removeFundHandler (msg, match){
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let fundName = match[2];

  let success = FundsRepository.removefund(fundName);
  let message = success ? `Удален сбор ${fundName}` : `Не удалось удалить сбор`;

  bot.sendMessage(msg.chat.id, message);
}



async function exportFundHandler (msg, fundName) {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

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
};

function closeFundHandler (msg, match) {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;
  let fundName = match[2];

  let success = FundsRepository.closefund(fundName);
  let message = success ? `Закрыт сбор ${fundName}` : `Не удалось закрыть сбор`;

  bot.sendMessage(msg.chat.id, message);
}

function changeFundStatusHandler(msg, match) {
  if (!UsersHelper.hasRole(msg.from.username, "admin", "accountant")) return;

  let fundName = match[2];
  let fundStatus = match[3].toLowerCase();

  let success = FundsRepository.changefundStatus(fundName, fundStatus);
  let message = success
    ? `Статус сбора ${fundName} изменен на ${fundStatus}`
    : `Не удалось изменить статус сбора`;

  bot.sendMessage(msg.chat.id, message);
}




async function addDonationHandler (msg, match) {
  if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

  let value = parseMoneyValue(match[2]);
  let currency =
    match[3].length > 0 ? match[3].toUpperCase() : currencyConfig.default;
  let userName = match[4].replace("@", "");
  let fundName = match[5];

  let success =
    !isNaN(value) &&
    FundsRepository.addDonationTo(fundName, userName, value, currency);
  let message = success
    ? `💸 ${tag()}${userName} задонатил ${value} ${currency} в сбор ${fundName}`
    : `Не удалось добавить донат`;

  bot.sendMessage(msg.chat.id, message);
}


async function costsHandler (msg, match){
  if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

  let value = parseMoneyValue(match[2]);
  let currency =
    match[3].length > 0 ? match[3].toUpperCase() : currencyConfig.default;
  let userName = match[4].replace("@", "");
  let fundName = FundsRepository.getLatestCosts().name;

  let success =
    !isNaN(value) &&
    FundsRepository.addDonationTo(fundName, userName, value, currency);
  let message = success
    ? `💸 ${tag()}${userName} задонатил ${value} ${currency} в сбор ${fundName}`
    : `Не удалось добавить донат`;

  bot.sendMessage(msg.chat.id, message);
}


function removeDonationHandler(msg, match){
  if (!UsersHelper.hasRole(msg.from.username, "accountant")) return;

  let donationId = match[2];

  let success = FundsRepository.removeDonationById(donationId);
  let message = success
    ? `Удален донат [id:${donationId}]`
    : `Не удалось удалить донат (может его и не было?)`;

  bot.sendMessage(msg.chat.id, message);
}


async function donateCardHandler(msg, match){
  let accountants = UsersRepository.getUsersByRole("accountant");
  let accountantsList = TextGenerators.getAccountsList(accountants, tag());

  let type = match[1];

  bot.sendMessage(
    msg.chat.id,
    `💌Для того, чтобы задонатить этим способом, напишите нашим бухгалтерам. Они подскажут вам текущие реквизиты или вы сможете договориться о времени и месте передачи. 

Вот они, слева-направо:
${accountantsList}
🛍 Если хочешь задонатить натурой или другим способом - жми /donate`
  );
}


async function donateCoinHandler (msg, match) {
  let coinname = match[1].toLowerCase();
  let buffer = await CoinsHelper.getQR(coinname);
  let coin = CoinsHelper.getCoinDefinition(coinname);

  bot.sendPhoto(msg.chat.id, buffer, {
    caption: `🪙 Используй этот QR код или адрес ниже, чтобы задонатить нам в ${coin.fullname}.

⚠️ Обрати внимание, что сеть ${coin.network} и ты используешь правильный адрес:
\`${coin.address}\`

⚠️ Кошельки пока работают в тестовом режиме, прежде чем слать большую сумму, попробуй что-нибудь совсем маленькое или напиши бухгалтеру

💌 Не забудь написать бухгалтеру, что ты задонатил(ла/ло) и скинуть код транзакции или ссылку
в https://mempool.space/ или аналогичном сервисе

🛍 Если хочешь задонатить натурой (ohh my) или другим способом - жми /donate`,
    parse_mode: "Markdown",
  });
}


function clearHandler (msg, match){
  if (!UsersHelper.hasRole(msg.from.username, "member")) return;

  let inputCount = Number(match[2]);
  let countToClear = inputCount > 0 ? inputCount : 1;
  let idsToRemove = popLast(msg.chat.id, countToClear);
  for (const id of idsToRemove) {
    bot.deleteMessage(msg.chat.id, id);
  }
}

function callbackHandler(callbackQuery) {
  const message = callbackQuery.message;
  const data = JSON.parse(callbackQuery.data);
  message.from = callbackQuery.from;

  switch (data.command) {
    case "/in":
      inHandler(message);
      break;
    case "/out":
      outHandler(message);
      break;
    case "/open":
      openHandler(message);
      break;
    case "/close":
      closeHandler(message);
      break;
    case "/status":
      statusHandler(message);
      break;
    case "/ef":
      exportFundHandler(message, ...data.params);
      break;
    case "/ed":
      exportDonutHandler(message, ...data.params);
      break;
    default:
      break;
  }

  bot.answerCallbackQuery(callbackQuery.id);
}

bot.onText(/^\/(printer)(@.+?)?$/, printerHandler);
bot.onText(/^\/(printerstatus)(@.+?)?$/, printerStatusHandler);
bot.onText(/^\/exportDonut(@.+?)? (.*\S)$/, async (msg, match) =>
  exportDonutHandler(msg, match[2])
);
bot.onText(/^\/autoinside(@.+?)?(?: (.*\S))?$/, async (msg, match) =>
  autoinsideHandler(msg, match[2])
);
bot.onText(/^\/(start|help)(@.+?)?$/, startHandler);
bot.onText(/^\/(about)(@.+?)?$/, aboutHandler);
bot.onText(/^\/(join)(@.+?)?$/, joinHandler);
bot.onText(/^\/(donate)(@.+?)?$/, donateHandler);
bot.onText(/^\/location(@.+?)?$/, locationHandler);
bot.onText(/^\/status(@.+?)?$/, statusHandler);
bot.onText(/^\/in(@.+?)?$/, inHandler);
bot.onText(/^\/open(@.+?)?$/, openHandler);
bot.onText(/^\/close(@.+?)?$/, closeHandler);
bot.onText(/^\/inForce(@.+?)? (\S+)$/, inForceHandler);
bot.onText(/^\/out(@.+?)?$/, outHandler);
bot.onText(/^\/outForce(@.+?)? (\S+)$/, outForceHandler);
bot.onText(/^\/birthdays(@.+?)?$/, async (msg) =>
  birthdayHandler(msg)
);
bot.onText(/^\/mybirthday(@.+?)?(?: (.*\S)?)?$/, async (msg, match) =>
  myBirthdayHandler(msg, match[2])
);
bot.onText(/^\/needs(@.+?)?$/, needsHandler);
bot.onText(/^\/buy(@.+?)? (.*)$/, buyHandler);
bot.onText(/^\/bought(@.+?)? (.*)$/, boughtHandler);
bot.onText(/^\/getUsers(@.+?)?$/, getUsersHandler);
bot.onText(/^\/addUser(@.+?)? (\S+?) as (\S+)$/, addUserHandler);
bot.onText(/^\/updateRoles(@.+?)? of (\S+?) to (\S+)$/, updateRolesHandler);
bot.onText(/^\/removeUser(@.+?)? (\S+)$/, removeUserHandler);
bot.onText(/^\/funds(@.+?)?$/, fundsHandler);
bot.onText(/^\/fund(@.+?)? (.*\S)$/, fundHandler);
bot.onText(/^\/fundsall(@.+?)?$/, fundsallHandler);
bot.onText(
  /^\/addFund(@.+?)? (.*\S) with target (\S+)\s?(\D*)$/,
  addFundHandler
);
bot.onText(
  /^\/updateFund(@.+?)? (.*\S) with target (\S+)\s?(\D*?)(?: as (.*\S))?$/,
  updateFundHandler
);
bot.onText(/^\/removeFund(@.+?)? (.*\S)$/, removeFundHandler);
bot.onText(/^\/exportFund(@.+?)? (.*\S)$/, async (msg, match) =>
  exportFundHandler(msg, match[2])
);
bot.onText(/^\/closeFund(@.+?)? (.*\S)$/, closeFundHandler);
bot.onText(/^\/changeFundStatus(@.+?)? of (.*\S) to (.*\S)$/, changeFundStatusHandler);
bot.onText(
  /^\/addDonation(@.+?)? (\S+)\s?(\D*?) from (\S+?) to (.*\S)$/,
  addDonationHandler
);
bot.onText(
  /^\/costs(@.+?)? (\S+)\s?(\D*?) from (\S+?)$/,
  costsHandler
);
bot.onText(/^\/removeDonation(@.+?)? (\d+)$/, removeDonationHandler);
bot.onText(/^\/donate(Cash|Card)(@.+?)?$/, donateCardHandler);
bot.onText(/^\/donate(BTC|ETH|USDC|USDT)(@.+?)?$/, donateCoinHandler);
bot.onText(/^\/clear(@.+?)?(?: (\d*))?$/, clearHandler);
bot.on("callback_query", callbackHandler);
bot.on("new_chat_members", newMemberHandler);





// Debug echoing of received messages
IsDebug &&
  bot.on("message", (msg) => {
    bot.sendMessage(
      msg.chat.id,
      `Debug: Received from ${msg.chat.id} message ${msg.text}`
    );
  });
