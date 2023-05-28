const UsersRepository = require("../../repositories/usersRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const Commands = require("../../resources/commands");
const CoinsHelper = require("../../resources/coins/coins");
const BaseHandlers = require("./base");

class BasicHandlers extends BaseHandlers {
  constructor() {
    super();
  }

  helpHandler = (msg) => {
    this.bot.sendMessage(
      msg.chat.id,
      `🇬🇧 Привет хакерчан. Я новый бот для менеджмента всяких процессов в спейсе. 
[Я еще нахожусь в разработке, ты можешь поучаствовать в моем развитии в репозитории на гитхабе спейса].
Держи мой список команд:\n` +
        UsersHelper.getAvailableCommands(msg.from.username) +
        `${Commands.GlobalModifiers}`
    );
  };

  aboutHandler = (msg) => {
    this.bot.sendMessage(
      msg.chat.id,
      `🏫 Hacker Embassy (Ереванский Хакспейс) - это пространство, где собираются единомышленники, увлеченные технологиями и творчеством. Мы вместе работаем над проектами, делимся идеями и знаниями, просто общаемся.
      
💻 Ты можешь почитать о нас подробнее на нашем сайте https://hackerembassy.site/

📓 Информацию о наших проектах, оборудовании и правилах мы храним на нашей вики https://wiki.hackerembassy.site/

🤖 Мой собственный код открыт и свободен, разработка ведётся на гитхабе: https://github.com/hackerembassy/hackerembassy-tg-bot 

🍕 Мы всегда рады новым резидентам. Хочешь узнать, как стать участником? Жми команду /join`
    );
  };

  joinHandler = (msg) => {
    let message = TextGenerators.getJoinText();
    this.bot.sendMessage(msg.chat.id, message);
  };

  issueHandler = async (msg, issueText) => {
    const helpMessage = `📮 С помощью этой команды можно полностью анонимно (исходный код бота открыт) сообщить о какой-либо проблеме в спейсе (чего-то не хватает, что-то не работает, кто-то делает что-то очень неправильное в спейсе).
Резиденты обязательно её рассмотрят и постараются решить.
Отправить боту проблему можно, например, вот так:

#\`/issue Плохо работает кондиционер и на первом этаже очень жарко#\`
#\`/issue Закончилась туалетная бумага#\`
#\`/issue Неплохо было бы иметь карту внутренней сети на вики#\``
    let message = `💌 Проблема анонимно отпралена резидентам, они обязательно её рассмотрят. Спасибо за помощь нашему сообществу.`;
    let report = `📩 Кто-то считает, что у нас в спейсе есть проблема, вот что он написал:
"${issueText}"`;
    if (issueText !== undefined){
      await this.bot.sendMessage(msg.chat.id, message);
      await this.bot.sendMessage(this.botConfig.chats.key, report);
    } else {
      await this.bot.sendMessage(msg.chat.id, helpMessage);
    }
  };

  donateHandler = (msg) => {
    let accountants = UsersRepository.getUsersByRole("accountant");
    let message = TextGenerators.getDonateText(accountants);
    this.bot.sendMessage(msg.chat.id, message);
  };

  locationHandler = (msg) => {
    let message = `🗺 Наш адрес: Армения, Ереван, Пушкина 38/18 (вход со двора)`;
    this.bot.sendMessage(msg.chat.id, message);
    this.bot.sendLocation(msg.chat.id, 40.18258, 44.51338);
    this.bot.sendPhoto(msg.chat.id, "./resources/images/house.jpg", {
      caption: `🏫 Вот этот домик, единственный в своем роде`,
    });
  };

  donateCoinHandler = async (msg, coinname) => {
    coinname = coinname.toLowerCase();
    let buffer = await CoinsHelper.getQR(coinname);
    let coin = CoinsHelper.getCoinDefinition(coinname);

    this.bot.sendPhoto(msg.chat.id, buffer, {
      parse_mode: "Markdown",
      caption: `🪙 Используй этот QR код или адрес ниже, чтобы задонатить нам в ${coin.fullname}.
      
⚠️ Обрати внимание, что сеть ${coin.network} и ты используешь правильный адрес:
\`${coin.address}\`
      
⚠️ Кошельки пока работают в тестовом режиме, прежде чем слать большую сумму, попробуй что-нибудь совсем маленькое или напиши бухгалтеру
      
💌 Не забудь написать бухгалтеру, что ты задонатил(ла/ло) и скинуть код транзакции или ссылку
в https://mempool.space/ или аналогичном сервисе
      
🛍 Если хочешь задонатить натурой (ohh my) или другим способом - жми /donate`,
    });
  };

  donateCardHandler = async (msg) => {
    let accountants = UsersRepository.getUsersByRole("accountant");
    let accountantsList = TextGenerators.getAccountsList(accountants);

    this.bot.sendMessage(
      msg.chat.id,
      `💌 Для того, чтобы задонатить этим способом, напишите нашим бухгалтерам. Они подскажут вам текущие реквизиты или вы сможете договориться о времени и месте передачи. 
      
Вот они, слева-направо:
      ${accountantsList}
🛍 Если хочешь задонатить натурой или другим способом - жми /donate`
    );
  };

  getResidentsHandler = (msg) => {
    let users = UsersRepository.getUsers().filter((u) => UsersHelper.hasRole(u.username, "member"));
    let message = TextGenerators.getResidentsList(users);

    this.bot.sendLongMessage(msg.chat.id, message);
  };

  startPanelHandler = async (msg, edit = false) => {
    let message = `🇬🇧 Привет хакерчан. Я новый бот для менеджмента всяких процессов в спейсе. 
[Я еще нахожусь в разработке, ты можешь поучаствовать в моем развитии в репозитории на гитхабе спейса, обращайся к #[korn9509#]#(t.me/korn9509#)].

🔖 Для получения полного списка команд доступных тебе вводи /help. Некоторые команды видны только резидентам.
📮 Что-то в спейсе не так? Вводи в боте /issue. Это абсолютно анонимно.
`;

    let inlineKeyboard = [
      [
        {
          text: "📯 Статус",
          callback_data: JSON.stringify({ command: "/status" }),
        },
        {
          text: "💸 Сборы",
          callback_data: JSON.stringify({ command: "/funds" }),
        },
      ],
      [
        {
          text: "🕹 Управление",
          callback_data: JSON.stringify({ command: "/controlpanel" }),
        },
        {
          text: "📚 Инфа",
          callback_data: JSON.stringify({ command: "/infopanel" }),
        },
      ],
      [
        {
          text: "🎉 Дни рождения",
          callback_data: JSON.stringify({ command: "/birthdays" }),
        },
        {
          text: "🛍 Нужды",
          callback_data: JSON.stringify({ command: "/needs" }),
        },
      ],
      [
        {
          text: "🖨 3D Принтеры",
          callback_data: JSON.stringify({ command: "/printer" }),
        },
        {
          text: "📝 Команды бота",
          callback_data: JSON.stringify({ command: "/help" }),
        },
      ],
    ];

    if (edit) {
      try {
        await this.bot.editMessageText(message, {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        });
      } catch {
        // Message was not modified
      }
    } else {
      await this.bot.sendMessage(msg.chat.id, message, {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      });
    }
  };

  controlPanelHandler = async (msg, edit = false) => {
    if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;

    let message = "🕹 Панель управления спейсом для резидентов";

    let inlineKeyboard = [
      [
        {
          text: "🔑 Замок",
          callback_data: JSON.stringify({ command: "/unlock" }),
        },
        {
          text: "🔔 Звонок",
          callback_data: JSON.stringify({ command: "/doorbell" }),
        },
      ],
      [
        {
          text: "📹 I этаж",
          callback_data: JSON.stringify({ command: "/webcam" }),
        },
        {
          text: "📹 II этаж",
          callback_data: JSON.stringify({ command: "/webcam2" }),
        },
        {
          text: "📹 Вход",
          callback_data: JSON.stringify({ command: "/doorcam" }),
        },
      ],
      [
        {
          text: "🩻 Суперстатус",
          callback_data: JSON.stringify({ command: "/superstatus" }),
        },
      ],
      [
        {
          text: "↩️ Назад",
          callback_data: JSON.stringify({ command: "/startpanel" }),
        },
      ],
    ];

    if (edit) {
      try {
        await this.bot.editMessageText(message, {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        });
      } catch {
        // Message was not modified
      }
    } else {
      await this.bot.sendMessage(msg.chat.id, message, {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      });
    }
  };

  infoPanelHandler = async (msg, edit = false) => {
    let message = `📚 Тут можно немного почитать о нас.
Если хочешь узнать побольше, не стесняйся, заходи на наш сайт и вики https://hackerembassy.site/`;

    let inlineKeyboard = [
      [
        {
          text: "🏠 О спейсе и боте",
          callback_data: JSON.stringify({ command: "/about" }),
        },
        {
          text: "🙋‍♀️ Как присоединиться",
          callback_data: JSON.stringify({ command: "/join" }),
        },
      ],
      [
        {
          text: "🗺 Как найти",
          callback_data: JSON.stringify({ command: "/location" }),
        },
        {
          text: "🎁 Как задонатить",
          callback_data: JSON.stringify({ command: "/donate" }),
        },
      ],
      [
        {
          text: "👩‍💻 Наши резиденты",
          callback_data: JSON.stringify({ command: "/getresidents" }),
        },
        {
          text: "↩️ Назад",
          callback_data: JSON.stringify({ command: "/startpanel" }),
        },
      ],
    ];

    if (edit) {
      try {
        await this.bot.editMessageText(message, {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        });
      } catch {
        // Message was not modified
      }
    } else {
      await this.bot.sendMessage(msg.chat.id, message, {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      });
    }
  };
}

module.exports = BasicHandlers;
