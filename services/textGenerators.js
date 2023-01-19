const Currency = require("../services/currency");

function excapeUnderscore(text){
  return text.replaceAll("_","\\_");
}

async function createFundList(funds, donations, addCommands = false, tag = "") {
  let list = "";

  for (const fund of funds) {
    if (!fund) continue;

    let fundDonations = donations.filter((donation) => {
      return donation.fund_id === fund.id;
    });

    let sum = await fundDonations.reduce(async (prev, current) => {
      let newValue = await Currency.convertCurrency(current.value, current.currency, fund.target_currency);
      return await prev + newValue;
    }, 0);

    let statusEmoji = `⚙️[${fund.status}]`;

    if (fund.status === "closed") {
      statusEmoji = "☑️ \\[закрыт\]";
    } else if (fund.status === "postponed") {
      statusEmoji = "⏱ \\[отложен\]";
    } else if (fund.status === "open") {
      statusEmoji = sum < fund.target_value ? "🟠" : "🟢";
    }

    list += `${statusEmoji} \`${fund.name}\` - Собрано ${sum.toFixed(2)} из ${fund.target_value} ${fund.target_currency}\n`;

    for (const donation of fundDonations) {
      list += `     \\[id:${donation.id}\] - ${tag}${excapeUnderscore(donation.username)} - ${donation.value} ${donation.currency}\n`;
    }
    
    if (addCommands){
      list += "\n";
      list += `\`/fund ${fund.name}\`\n`;
      list += `\`/exportFund ${fund.name}\`\n`;
      list += `\`/exportDonut ${fund.name}\`\n`;
      list += `\`/updateFund ${fund.name} with target 10000 AMD as ${fund.name}\`\n`;
      list += `\`/changeFundStatus of ${fund.name} to status_name\`\n`;
      list += `\`/closeFund ${fund.name}\`\n`;
      list += `\`/addDonation 5000 AMD from @username to ${fund.name}\`\n`;
      list += `\`/removeDonation donation_id\`\n`;
    }

    list+="\n";
  }

  return list;
}

let getStatusMessage = (state, inside, tag = "") => {
  let stateText = state.open ? "открыт" : "закрыт";
  let stateEmoji = state.open ? "🔓" : "🔒";
  let stateSubText = state.open ? "Отличный повод зайти" : "Ждем, пока кто-то из резидентов его откроет";
  let insideText = state.open
    ? inside.length > 0
      ? "👨‍💻 Внутри отметились:\n"
      : "🛌 Внутри никто не отметился\n"
    : "";
  for (const user of inside) {
    insideText += `${tag}${user.username}\n`;
  }

  return `${stateEmoji} Спейс ${stateText} ${tag}${state.changedby}
${stateSubText}

🗓 ${state.date.toLocaleString()}
  
` + insideText;
}

function getAccountsList(accountants, tag = ""){
  let accountantsList = "";

  if (accountants !== null) {
    accountantsList = accountants.reduce(
      (list, user) => `${list}${tag}${user.username}\n`,
      ""
    );
  }

  return accountantsList;
}

function getDonateText(accountants, tag = "", isApi = false){
  let accountantsList = getAccountsList(accountants, tag);

 return `💸 Хакспейс не является коммерческим проектом и существует исключительно на пожертвования участников.
 Мы вносим свой вклад в развитие хакспейса: оплата аренды и коммуналки, забота о пространстве, помощь в приобретении оборудования.
 Мы будем рады любой поддержке. 
 
 Задонатить нам можно следующими способами:
 💳 Банковская карта Visa/Mastercard Армении.
       ${!isApi?"/donateCard":""}
 🪙 Криптовалюта ${!isApi?`(по следующим командам)
       /donateBTC
       /donateETH
       /donateUSDC
       /donateUSDT`:""}
 💵 Наличкой при встрече (самый лучший вариант).
       ${!isApi?"/donateCash\n":""}
 📊 Увидеть наши текущие сборы и ваш вклад можно по команде ${!isApi?"/":""}funds
 
 💌 По вопросам доната обращайтесь к нашим бухгалтерам, они помогут.\n` +
       accountantsList
}

function getJoinText(isApi = false){
  return `🧑🏻‍🏫 Если вы находитесь в Ереване, увлечены технологиями и ищете единомышленников, заходите к нам.
- Мы проводим регулярный день открытых дверей каждую пятницу в 20.00.
- Часто по понедельникам в 20.00 мы проводим музыкальные встречи: приносим гитары, играем в Rocksmith и джемим.
- В любой другой день спейс тоже может принять гостей, вводи команду /status чтобы узнать открыт ли спейс и есть ли там кто-нибудь.

💸 Посещения свободные (бесплатные), но любые донаты на помощь нашим проектам и аренду дома очень приветствуются.
Подробнее можно узнать по команде ${!isApi?"/":""}donate

${!isApi?"🗺 Чтобы узнать, как нас найти, жми /location\n":""}
🔑 Если вы хотите стать постоянным участником - полноценным резидентом сообщества, т.е. иметь свой ключ, своё место для хранения вещей (инструменты, сервера и.т.п.), участвовать в принятии решений о развитии спейса,\
 то наши требования просты:
- Дружелюбность и неконфликтность.
- Готовность участвовать в жизни сообщества.
- Регулярные пожертвования (естественно в рамках ваших возможностей).

🧙🏻‍♂️ Обратитесь к любому резиденту спейса, он представит вашу кандидатуру Совету Спейса.
`
}

module.exports = { createFundList, getAccountsList, getStatusMessage, getDonateText, getJoinText };
