const Currency = require("../services/currency");
const config = require("config");
const printer3dConfig = config.get("printer3d");
const apiBase = printer3dConfig.apibase;
const BotExtensions = require("../bot/botExtensions");
const StatusRepository = require("../repositories/statusRepository");

async function createFundList(funds, donations, showAdmin = false, isApi = false) {
  let list = "";

  for (const fund of funds) {
    if (!fund) continue;

    let fundDonations = donations.filter((donation) => {
      return donation.fund_id === fund.id;
    });

    let sum = await fundDonations.reduce(async (prev, current) => {
      let newValue = await Currency.convertCurrency(
        current.value,
        current.currency,
        fund.target_currency
      );
      return (await prev) + newValue;
    }, 0);

    let statusEmoji = `⚙️\\[${fund.status}]`;

    if (fund.status === "closed") {
      statusEmoji = "☑️ \\[закрыт]";
    } else if (fund.status === "postponed") {
      statusEmoji = "⏱ \\[отложен]";
    } else if (fund.status === "open") {
      statusEmoji = sum < fund.target_value ? "🟠" : "🟢";
    }

    let tgCopyDelimiter = isApi ? "" : "#\`";

    list += `${statusEmoji} ${tgCopyDelimiter}${fund.name}${tgCopyDelimiter} - Собрано ${Currency.formatCurrency(sum, fund.target_currency)} из ${
      fund.target_value
    } ${fund.target_currency}\n`;

    for (const donation of fundDonations) {
      list += `      ${showAdmin ? `[id:${donation.id}] - `: ""}${BotExtensions.formatUsername(
        donation.username, isApi
      )} - ${Currency.formatCurrency(donation.value, donation.currency)} ${donation.currency}${showAdmin && donation.accountant ? ` ➡️ ${BotExtensions.formatUsername(donation.accountant, isApi)}` : ""}\n`;
    }

    if (showAdmin) {
      list += "\n";
      list += `#\`/fund ${fund.name}#\`\n`;
      list += `#\`/exportFund ${fund.name}#\`\n`;
      list += `#\`/exportDonut ${fund.name}#\`\n`;
      list += `#\`/updateFund ${fund.name} with target 10000 AMD as ${fund.name}#\`\n`;
      list += `#\`/changeFundStatus of ${fund.name} to status_name#\`\n`;
      list += `#\`/closeFund ${fund.name}#\`\n`;
      list += `#\`/transferDonation donation_id to username#\`\n`;
      list += `#\`/addDonation 5000 AMD from @username to ${fund.name}#\`\n`;
      list += `#\`/removeDonation donation_id#\`\n`;
    }

    list += "\n";
  }

  return list;
}

let getStatusMessage = (state, inside, isApi = false) => {
  let stateText = state.open ? "открыт" : "закрыт";
  let stateEmoji = state.open ? "🔓" : "🔒";
  let stateSubText = state.open
    ? "Отличный повод зайти, так что стучитесь в дверь или пишите находящимся внутри - вам откроют\n"
    : "Ждем, пока кто-то из резидентов его откроет\n";
  let insideText = state.open
    ? inside.length > 0
      ? "👨‍💻 Внутри отметились:\n"
      : "🛌 Внутри никто не отметился\n"
    : "";

  for (const user of inside) {
    insideText += `${BotExtensions.formatUsername(user.username, isApi)}${user.type === StatusRepository.ChangeType.Auto ? " (auto)" : ""}\n`;
  }

  let dateString = state.date.toLocaleString("RU-ru").replace(","," в").substr(0, 18)

  return (
    `${stateEmoji} Спейс ${stateText} ${BotExtensions.formatUsername(state.changedby, isApi)} ${dateString}
${stateSubText}
` + insideText + `
📲 Попробуй команду /autoinside чтобы отмечаться в спейсе автоматически
`
  );
};

function getAccountsList(accountants, isApi = false) {
  let accountantsList = "";

  if (accountants !== null) {
    accountantsList = accountants.reduce(
      (list, user) => `${list}${BotExtensions.formatUsername(user.username, isApi)}\n`,
      ""
    );
  }

  return accountantsList;
}

function getNeedsList(needs) {
  let message = `👌 Пока никто не просил ничего\n`;

  if (needs.length > 0) {
    message = `🙏 Кто-нибудь, купите по дороге в спейс:\n`;

    for (const need of needs) {
      message += `- #\`${need.text}#\` по просьбе ${BotExtensions.formatUsername(
        need.requester
      )}\n`;
    }

  }
  message += `\nℹ️ Можно попросить купить что-нибудь по дороге в спейс с помощью команды #\`/buy item_name#\``;

  if (needs.length > 0) {
    message += `\n✅ Отметить покупку сделанной можно нажав на кнопку ниже: `;
  }
  
  return message;
}

function getDonateText(accountants, isApi = false) {
  let accountantsList = getAccountsList(accountants, isApi);

  return (
    `💸 Хакспейс не является коммерческим проектом и существует исключительно на пожертвования участников.
 Мы вносим свой вклад в развитие хакспейса: оплата аренды и коммуналки, забота о пространстве, помощь в приобретении оборудования.
 Мы будем рады любой поддержке. 
 
 Задонатить нам можно следующими способами:
 💳 Банковская карта Visa/Mastercard Армении.${
   !isApi ? "\n       /donateCard" : ""
 }
 💰 Криптовалюта ${
   !isApi
     ? `(по следующим командам)
       /donateBTC
       /donateETH
       /donateUSDC
       /donateUSDT`
     : ""
 }
 💵 Наличкой при встрече (самый лучший вариант).
       ${!isApi ? "/donateCash\n" : ""}
 📊 Увидеть наши текущие сборы и ваш вклад можно по команде ${
   !isApi ? "/" : ""
 }funds
 
 💌 По вопросам доната обращайтесь к нашим бухгалтерам, они помогут.\n` +
    accountantsList
  );
}

function getJoinText(isApi = false) {
  return `🧑🏻‍🏫 Если вы находитесь в Ереване, увлечены технологиями и ищете единомышленников, заходите к нам.
- Мы проводим регулярный день открытых дверей каждую пятницу в 20.00.
- Часто по понедельникам в 20.00 мы проводим музыкальные встречи: приносим гитары, играем в Rocksmith и джемим.
- В любой другой день спейс тоже может принять гостей, вводи команду ${
    !isApi ? "/" : ""
  }status чтобы узнать открыт ли спейс и есть ли там кто-нибудь.

💸 Посещения свободные (бесплатные), но любые донаты на помощь нашим проектам и аренду дома очень приветствуются.
Подробнее можно узнать по команде ${!isApi ? "/" : ""}donate
${!isApi ? "\n🗺 Чтобы узнать, как нас найти, жми /location\n" : ""}
🔑 Если вы хотите стать постоянным участником - полноценным резидентом сообщества, т.е. иметь свой ключ, своё место для хранения вещей (инструменты, сервера и.т.п.), участвовать в принятии решений о развитии спейса,\
 то наши требования просты:
- Дружелюбность и неконфликтность.
- Готовность участвовать в жизни сообщества.
- Регулярные пожертвования (естественно в рамках ваших возможностей).

🧙🏻‍♂️ Обратитесь к любому резиденту спейса, он представит вашу кандидатуру Совету Спейса.
`;
}

const shortMonthNames = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
]

function getBirthdaysList(birthdayUsers){
  let message = `🎂 В этом месяце празднуют свои днюхи:\n`;

  let usersList = `\nНикто? Странно...\n`;

  if (birthdayUsers) {
    let usersWithDays =  birthdayUsers
    .map(u => {
      let parts = u.birthday.split("-");
      return {
        day: Number(parts[2]),
        month: Number(parts[1]),
        ...u
      }
    })
    .filter(u => {
      return u.month === (new Date()).getMonth()+1;
    })
    .sort((u1, u2) => u1.day - u2.day);

    if (usersWithDays.length > 0){
      usersList = ``;
      for (const user of usersWithDays) {      
        message += `${user.day} ${shortMonthNames[user.month-1]} - ${BotExtensions.formatUsername(user.username)}\n`;
      }
    }
  }

  message += `${usersList}
Хочешь, чтобы тебя тоже поздравили? Добавляй свою днюху командой в форматах:
#\`/mybirthday YYYY-MM-DD#\`
#\`/mybirthday MM-DD#\`
Надоели поздравления себя? Вводи команду:
#\`/mybirthday remove#\``;

  return message;
}

function getPrinterInfo(){
  return `🖨 3D принтер Anette от ubershy и cake64
Документация по нему доступна тут:
https://github.com/hackerembassy/printer-anette
Веб интерфейс доступен внутри сети спейса по адресу ${apiBase}
Статус принтера можно узнать по команде /printerstatus
`
}

async function getPrinterStatus(status) {
  let print_stats = status.print_stats;
  let state = print_stats.state;
  let heater_bed = status.heater_bed;
  let extruder = status.extruder;

  let message = `💤 Статус принтера: ${state}`;

  if (state === "printing") {
    let minutesPast = (print_stats.total_duration / 60).toFixed(2);
    let progress = (status.display_status.progress * 100).toFixed(0);
    let estimate = (((minutesPast / progress) * (100 - progress))).toFixed(2);

    message = `⏲ Печатается ${print_stats.filename}

🕔 Процент файл завершения ${progress}%
   Прошло ${minutesPast} минут
   Осталось ~${estimate} минут

📏 Использовано ${print_stats.filament_used.toFixed(2)} мм филамента

🔥 Температура экструдера ${extruder.temperature} C, целевая ${
      extruder.target
    } C
   Температура стола ${heater_bed.temperature} C, целевая ${heater_bed.target} C
`;
  }

  return message;
}

module.exports = {
  createFundList,
  getAccountsList,
  getStatusMessage,
  getDonateText,
  getJoinText,
  getNeedsList,
  getPrinterInfo,
  getPrinterStatus,
  getBirthdaysList
};
