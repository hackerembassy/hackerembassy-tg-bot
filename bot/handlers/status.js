const StatusRepository = require("../../repositories/statusRepository");
const UsersRepository = require("../../repositories/usersRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const BaseHandlers = require("./base");
const { openSpace, closeSpace } = require("../../services/statusHelper");
const { isStatusError } = require("../../services/autoInOut")

class StatusHandlers extends BaseHandlers {
  constructor() {
    super();
  }

  setmacHandler(msg, cmd) {
    let message = `⚠️ Укажите валидный MAC адрес (или несколько, через запятую)`;
    let username = msg.from.username;
    if (!cmd || cmd === "help") {
      message = `
📡 С помощью этой команды можно задать MAC адреса для функций автовхода и управления замком 

#\`/setmac mac_address#\` - Добавить свой MAC адрес (или несколько, через запятую)
#\`/setmac status#\` - Посмотреть свой установленный в боте MAC адрес
#\`/setmac remove#\` - Удалить свой MAC адрес из бота  
 `;
    } else if (cmd && UsersRepository.testMACs(cmd) && UsersRepository.setMACs(username, cmd)) {
      message = `📡 MAC адрес ${cmd} успешно добавлен для юзера ${this.bot.formatUsername(username)}.`;
    } else if (cmd === "remove") {
      UsersRepository.setMACs(username, null);
      UsersRepository.setAutoinside(username, false);
      message = `🗑 MAC удален для юзера ${this.bot.formatUsername(username)}. Автовход теперь работать не будет.`;
    } else if (cmd === "status") {
      let usermac = UsersRepository.getUser(username)?.mac;
      if (usermac)
        message = `📲 Для юзера ${this.bot.formatUsername(username)} задан MAC адрес ${usermac}`;
      else message = `📲 MAC адрес не задан для юзера ${this.bot.formatUsername(username)}`;
    }

    this.bot.sendMessage(msg.chat.id, message);
  }

  autoinsideHandler(msg, cmd) {
    let message = `⚠️ Не удалось включить автовход, хотя MAC задан. Кто-нибудь, накостыляйте моему разработчику`;
    let username = msg.from.username;
    let user = UsersRepository.getUser(username);
    let usermac = user?.mac;
    let userautoinside = user?.autoinside;

    if (!cmd || cmd === "help") {
      message = `⏲ С помощью этой команды можно автоматически отмечаться в спейсе как только MAC адрес вашего устройства будет обнаружен в сети.
📌 При отсутствии активности устройства в сети спейса в течение ${this.botConfig.timeouts.out / 60000
        } минут произойдет автовыход юзера.
📌 При включенной фиче актуальный статус устройства в сети имеет приоритет над ручными командами входа/выхода.
⚠️ Для работы обязательно задайте MAC адреса вашего устройства и отключите его рандомизацию для сети спейса.
      
#\`/setmac#\` - Управление своим MAC адресом  
#\`/autoinside status#\` - Статус автовхода и автовыхода
#\`/autoinside enable#\` - Включить автовход и автовыход  
#\`/autoinside disable#\` - Выключить автовход и автовыход  
`;
    } else if (cmd === "enable") {
      if (!usermac)
        message = `⚠️ Твой MAC адрес не задан. Добавь его командой #\`/setmac mac_address#\``;
      else if (UsersRepository.setAutoinside(username, true))
        message = `🕺 Автовход и автовыход активированы для юзера ${this.bot.formatUsername(username)} на MAC адрес ${usermac}`;
    } else if (cmd === "disable") {
      UsersRepository.setAutoinside(username, false);
      message = `🚷 Автовход и автовыход выключены для юзера ${this.bot.formatUsername(username)}`;
    } else if (cmd === "status") {
      if (userautoinside)
        message = `🕺 Автовход и автовыход включены для юзера ${this.bot.formatUsername(username)} на MAC адрес ${usermac}`;
      else message = `🚷 Автовход и автовыход выключены для юзера ${this.bot.formatUsername(username)}`;
    }

    this.bot.sendMessage(msg.chat.id, message);
  }

  statusHandler = async (msg, edit = false) => {
    let state = StatusRepository.getSpaceLastState();

    if (!state) {
      this.bot.sendMessage(msg.chat.id, `🔐 Статус спейса неопределен`);
      return;
    }

    let inside = StatusRepository.getPeopleInside();
    let going = StatusRepository.getPeopleGoing();
    let statusMessage = TextGenerators.getStatusMessage(state, inside, going);

    if (isStatusError())
      statusMessage = `📵 Не удалось связаться со спейсом. Данные о посетителях могут быть неактуальными \n\n${statusMessage}`;
    

    let inlineKeyboard = state.open
      ? [
        [
          {
            text: "🤝 Я пришёл в спейс",
            callback_data: JSON.stringify({ command: "/in" }),
          },
          {
            text: "👋 Я ушёл из спейса",
            callback_data: JSON.stringify({ command: "/out" }),
          },
        ],
      ]
      : [];

    inlineKeyboard.push([
      {
        text: "🚕 Планирую в спейс",
        callback_data: JSON.stringify({ command: "/going" }),
      },
      {
        text: "🛌 Уже не планирую",
        callback_data: JSON.stringify({ command: "/notgoing" }),
      },
    ]);

    inlineKeyboard.push([
      {
        text: "🔃 Обновить",
        callback_data: JSON.stringify({ command: "/ustatus" }),
      },
      {
        text: state.open ? "🔒 Закрыть спейс" : "🔓 Открыть спейс",
        callback_data: state.open ? JSON.stringify({ command: "/close" }) : JSON.stringify({ command: "/open" }),
      },
    ]);

    if (edit) {
      try {
        await this.bot.editMessageText(statusMessage, {
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
      await this.bot.sendMessage(msg.chat.id, statusMessage, {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      });
    }
  };

  openHandler = (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "member")) return;

    openSpace(msg.from.username, {checkOpener: true})

    let inlineKeyboard = [
      [
        {
          text: "🤝 Я тоже пришёл",
          callback_data: JSON.stringify({ command: "/in" }),
        },
        {
          text: "🔒 Закрыть снова",
          callback_data: JSON.stringify({ command: "/close" }),
        },
      ],
      [
        {
          text: "📹 Кто внутри",
          callback_data: JSON.stringify({ command: "/status" }),
        },
      ],
    ];

    this.bot.sendMessage(
      msg.chat.id,
      `🔑 ${this.bot.formatUsername(msg.from.username)} #*открыл#* спейс для гостей. Отличный повод зайти`,
      {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      }
    );
  };

  closeHandler = (msg) => {
    if (!UsersHelper.hasRole(msg.from.username, "member")) return;

    closeSpace(msg.from.username, {evict: true});

    let inlineKeyboard = [
      [
        {
          text: "🔓 Открыть снова",
          callback_data: JSON.stringify({ command: "/open" }),
        },
      ],
    ];

    this.bot.sendMessage(
      msg.chat.id,
      `🔒 ${this.bot.formatUsername(msg.from.username)} #*закрыл#* спейс. Все отметившиеся отправлены домой`,
      {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      }
    );
  };

  inHandler = (msg) => {
    let eventDate = new Date();
    let user = msg.from.username ?? msg.from.first_name;
    let gotIn = this.LetIn(user, eventDate);
    let autoinsideText = `📲 Попробуй команду /autoinside чтобы отмечаться в спейсе автоматически`;
    let message = `🤝 ${this.bot.formatUsername(user)} пришел в спейс\n\n${autoinsideText}`;

    if (!gotIn) {
      message = "🔐 Сейчас спейс не готов принять гостей";
    }

    let inlineKeyboard = gotIn
      ? [
        [
          {
            text: "🤝 Я тоже пришёл",
            callback_data: JSON.stringify({ command: "/in" }),
          },
          {
            text: "👋 А я уже ушёл",
            callback_data: JSON.stringify({ command: "/out" }),
          },
        ],
        [
          {
            text: "📹 Кто внутри",
            callback_data: JSON.stringify({ command: "/status" }),
          },
        ],
      ]
      : [
        [
          {
            text: "🔃 Повторить команду",
            callback_data: JSON.stringify({ command: "/in" }),
          },
          {
            text: "🔓 Открыть спейс",
            callback_data: JSON.stringify({ command: "/open" }),
          },
        ],
      ];

    this.bot.sendMessage(msg.chat.id, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  };

  outHandler = (msg) => {
    let eventDate = new Date();
    let gotOut = this.LetOut(msg.from.username, eventDate);
    let message = `👋 ${this.bot.formatUsername(msg.from.username)} ушел из спейса`;

    if (!gotOut) {
      message = "🔐 Странно, ты же не должен был быть внутри...";
    }

    let inlineKeyboard = gotOut
      ? [
        [
          {
            text: "👋 Я тоже ушёл",
            callback_data: JSON.stringify({ command: "/out" }),
          },
          {
            text: "🤝 А я пришёл",
            callback_data: JSON.stringify({ command: "/in" }),
          },
        ],
        [
          {
            text: "📹 Кто внутри",
            callback_data: JSON.stringify({ command: "/status" }),
          },
        ],
      ]
      : [
        [
          {
            text: "🔃 Повторить команду",
            callback_data: JSON.stringify({ command: "/out" }),
          },
          {
            text: "🔓 Открыть спейс",
            callback_data: JSON.stringify({ command: "/open" }),
          },
        ],
      ];

    this.bot.sendMessage(msg.chat.id, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  };

  inForceHandler = (msg, username) => {
    if (!UsersHelper.hasRole(msg.from.username, "member")) return;
    username = username.replace("@", "");
    let eventDate = new Date();

    let gotIn = this.LetIn(username, eventDate, true);

    let message = `🟢 ${this.bot.formatUsername(msg.from.username)} привёл ${this.bot.formatUsername(username)} в спейс`;

    if (!gotIn) {
      message = "🔐 Сорян, ты не можете сейчас его привести";
    }
    this.bot.sendMessage(msg.chat.id, message);
  };

  outForceHandler = (msg, username) => {
    if (!UsersHelper.hasRole(msg.from.username, "member")) return;
    let eventDate = new Date();
    username = username.replace("@", "");
    let gotOut = this.LetOut(username, eventDate, true);

    let message = `🔴 ${this.bot.formatUsername(msg.from.username)} отправил домой ${this.bot.formatUsername(username)}`;

    if (!gotOut) {
      message = "🔐 Ээ нее, ты не можешь его отправить домой";
    }

    this.bot.sendMessage(msg.chat.id, message);
  };

  LetIn(username, date, force = false) {
    // check that space is open
    let state = StatusRepository.getSpaceLastState();

    if (!state?.open && !UsersHelper.hasRole(username, "member") && !force) return false;

    let userstate = {
      status: StatusRepository.UserStatusType.Inside,
      date: date,
      username: username,
      type: force ? StatusRepository.ChangeType.Force : StatusRepository.ChangeType.Manual,
    };

    StatusRepository.pushPeopleState(userstate);

    return true;
  }

  LetOut(username, date, force = false) {
    let state = StatusRepository.getSpaceLastState();

    if (!state?.open && !UsersHelper.hasRole(username, "member") && !force) return false;

    let userstate = {
      status: StatusRepository.UserStatusType.Outside,
      date: date,
      username: username,
      type: force ? StatusRepository.ChangeType.Force : StatusRepository.ChangeType.Manual,
    };

    StatusRepository.pushPeopleState(userstate);

    return true;
  }

  goingHandler = (msg) => {
    let username = msg.from.username.replace("@", "");
    let eventDate = new Date();

    let userstate = {
      status: StatusRepository.UserStatusType.Going,
      date: eventDate,
      username: username,
      type: StatusRepository.ChangeType.Manual,
    };

    StatusRepository.pushPeopleState(userstate);

    let message = `🚕 ${this.bot.formatUsername(msg.from.username)} планирует сегодня зайти в спейс`;

    let inlineKeyboard = [[
      {
        text: "🚕 Я тоже планирую",
        callback_data: JSON.stringify({ command: "/going" }),
      },
      {
        text: "❓ А кто еще будет?",
        callback_data: JSON.stringify({ command: "/status" }),
      },
    ]]

    this.bot.sendMessage(msg.chat.id, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  };

  notGoingHandler = (msg) => {
    let username = msg.from.username.replace("@", "");
    let eventDate = new Date();

    let userstate = {
      status: StatusRepository.UserStatusType.Outside,
      date: eventDate,
      username: username,
      type: StatusRepository.ChangeType.Manual,
    };

    StatusRepository.pushPeopleState(userstate);

    let message = `🛌 ${this.bot.formatUsername(msg.from.username)} больше не планирует сегодня в спейс`;

    this.bot.sendMessage(msg.chat.id, message);
  };

  setemojiHandler(msg, emoji) {
    if (!UsersHelper.hasRole(msg.from.username, "member")) return;

    let message = `⚠️ Укажите валидный эмодзи адрес`;
    let username = msg.from.username;
    if (!emoji || emoji === "help") {
      message = `
🐥 С помощью этой команды можно задать эмодзи 

#\`/setemoji 🍗#\` - Установить себе эмодзи 
#\`/setemoji status#\` - Посмотреть свой установленный в боте эмодзи
#\`/setemoji remove#\` - Удалить свой эмодзи из бота  
 `;
    } else if (emoji && isEmoji(emoji) && UsersRepository.setEmoji(username, emoji)) {
      message = `🐥 Эмодзи ${emoji} успешно установлен для юзера ${this.bot.formatUsername(username)}.`;
    } else if (emoji === "remove") {
      UsersRepository.setEmoji(username, null);
      message = `🗑 Эмодзи удален для юзера ${this.bot.formatUsername(username)}.`;
    } else if (emoji === "status") {
      let emoji = UsersRepository.getUser(username)?.emoji;

      if (emoji)
        message = `🐥 Для юзера ${this.bot.formatUsername(username)} задан эмодзи ${emoji}`;
      else message = `🐥 Эмодзи не задан для юзера ${this.bot.formatUsername(username)}`;
    }

    this.bot.sendMessage(msg.chat.id, message);
  }
}

function isEmoji(message) {
  return /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/u.test(message)
}

module.exports = StatusHandlers;
