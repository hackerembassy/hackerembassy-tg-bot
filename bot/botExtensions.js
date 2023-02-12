const config = require("config");
const botConfig = config.get("bot");
const UsersRepository = require("../repositories/usersRepository");
const fs = require("fs/promises");
const path = require("path");

const maxChunkSize = 3000;
const messagedelay = 1500;

let mode = {
  silent: false,
  mention: false,
  admin: false,
};

let history = [];

// Helper functions

function chunkSubstr(str, size) {
  const chunks = [];
  let i = 0;

  if (str.length < size) return [str];

  while (str.length > 0) {
    let tmp = str.substr(0, size);
    let indexOfLastNewLine = tmp.lastIndexOf("\n");
    let chunkLength = indexOfLastNewLine > 0 ? indexOfLastNewLine : size;
    chunks.push(tmp.substr(0, chunkLength));
    str = str.substr(chunkLength);
    i++;
  }

  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Extensions

function addLongCommands(bot) {
  bot.sendLongMessage = async (chatid, text, options) => {
    let chunks = chunkSubstr(text, maxChunkSize);

    if (chunks.length === 1) {
      bot.sendMessage(chatid, chunks[0], options);
      return;
    }

    for (let index = 0; index < chunks.length; index++) {
      bot.sendMessage(
        chatid,
        `{${index + 1} часть}
${chunks[index]}
{Конец части ${index + 1}}`,
        options
      );
      await sleep(messagedelay);
    }
  };
}

function initGlobalModifiers(bot) {
  let addedModifiersString = Object.keys(mode)
    .reduce((acc, key) => {
      return `${acc} -${key}|`;
    }, "(")
    .replace(/\|$/, ")*");

  let onTextOriginal = bot.onText;
  let sendMessageOriginal = bot.sendMessage;

  bot.sendMessage = async function (...args) {
    if (!mode.silent) {
      return sendMessageOriginal.call(this, ...args);
    }
  };

  bot.onText = async function (...args) {
    let originalRegex = args[0];
    let originalFunc = args[1];

    args[0] = new RegExp(
      originalRegex
        .toString()
        .substring(1, originalRegex.toString().length - 1)
        .replace("$", `${addedModifiersString}$`)
    );
    args[1] = async function (...funcargs) {
      let match = funcargs[1];
      let newCommand = match[0];

      for (const key of Object.keys(mode)) {
        newCommand = newCommand.replace(` -${key}`, "");
      }

      if (funcargs[1] !== undefined) funcargs[1] = originalRegex.exec(newCommand);

      let oldmode = { ...mode };

      for (const key of Object.keys(mode)) {
        if (match[0].includes(`-${key}`)) mode[key] = true;
      }

      await originalFunc.call(this, ...funcargs);

      mode = oldmode;
    };

    onTextOriginal.call(this, ...args);
  };
}

function makeAllMessagesMarkdown(bot) {
  let sendMessageOriginal = bot.sendMessage;

  bot.sendMessage = async function (...args) {
    let message = args[1];
    message = message.replaceAll(/((?<![\\|#])[_\*\[\]\(\)~`>\+\-=\|{}\.!]{1})/g, "\\$1");
    message = message.replaceAll(/#([_\*\[\]\(\)~`>\+\-=\|{}\.!]{1})/g, "$1");
    message = message.replaceAll(/#/g, "");
    args[1] = message;

    let options = {...args[2]};
    options.parse_mode = "MarkdownV2";
    options.disable_web_page_preview=true;
    args[2] = options;

    return sendMessageOriginal.call(this, ...args);
  };
}

function addSavingLastMessages(bot) {
  let sendMessageOriginal = bot.sendMessage;
  let sendPhotoOriginal = bot.sendPhoto;

  bot.sendMessage = async function (...args) {
    let chatId = args[0];
    let message = await sendMessageOriginal.call(this, ...args);

    if (!message) return;

    let messageId = message.message_id;

    if (!history[chatId]) history[chatId] = [];
    history[chatId].push(messageId);
  };

  bot.sendPhoto = async function (...args) {
    let chatId = args[0];
    let message = await sendPhotoOriginal.call(this, ...args);
    let messageId = message.message_id;

    if (!history[chatId]) history[chatId] = [];
    history[chatId].push(messageId);
  };
}

// Public extension related functions

function extendWithFormatUserName(bot){
  bot.formatUsername = formatUsername;
}

function formatUsername(username){
  username = username.replace("@","");

  if (mode.mention)
    return `@${username}`.replaceAll("_", "\\_");
  else
    return `#[${username}#]#(t.me/${username}#)`
}

function extendWithIsAdminMode(bot){
  bot.isAdminMode = isAdminMode;
}

function isAdminMode() {
  return mode.admin;
}

function* popLast(chatId, count) {
  for (let index = 0; index < count; index++) {
    if (!history[chatId] || history[chatId].length === 0) return [];
    yield history[chatId].pop();
  }
}

// Birthday autowishes

const baseWishesDir = "./resources/wishes";
const wishedTodayPath = "./data/wished-today.json";

async function getWish(username) {
  let files = await fs.readdir(baseWishesDir);
  let randomNum = Math.floor(Math.random() * files.length);
  let wishTemplate = await fs.readFile(path.join(baseWishesDir, files[randomNum]), { encoding: "utf8" });

  return wishTemplate.replaceAll(/\$username/g, `@${username}`);
}

async function sendBirthdayWishes(force = false) {
  let currentDate = new Date().toLocaleDateString("sv").substring(5, 10);
  let birthdayUsers = UsersRepository.getUsers().filter((u) => {
    return u.birthday?.substring(5, 10) === currentDate;
  });

  if (await fs.access(wishedTodayPath).catch(() => true)) {
    fs.writeFile(wishedTodayPath, "[]");
  }

  let wishedToday = JSON.parse(await fs.readFile(wishedTodayPath, "utf8"));
  let wishedAmount = wishedToday?.length;

  for (const user of birthdayUsers) {
    let wishedUser = wishedToday.find((entry) => entry.username && entry.date === currentDate);
    if (!force && wishedUser) continue;

    let message = "🎂 ";
    message += await getWish(user.username);

    this.sendMessage(botConfig.chats.main, message);

    if (!wishedUser) wishedToday.push({ username: user.username, date: currentDate });

    sleep(30000);
  }

  if (wishedAmount !== wishedToday.length) fs.writeFile(wishedTodayPath, JSON.stringify(wishedToday));
}

function enableAutoWishes(bot) {
  bot.sendBirthdayWishes = sendBirthdayWishes;
  setInterval(() => bot.sendBirthdayWishes(false), 3600000);
}

module.exports = {
  mode,
  initGlobalModifiers,
  formatUsername,
  popLast,
  isAdminMode,
  addLongCommands,
  makeAllMessagesMarkdown,
  addSavingLastMessages,
  enableAutoWishes,
  extendWithFormatUserName,
  extendWithIsAdminMode
};
