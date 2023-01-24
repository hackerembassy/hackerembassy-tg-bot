const maxChunkSize = 3000;
const messagedelay = 1500;

let mode = {
  silent: false,
  nomention: false,
  nocommands: false,
};

let history = [];

// Helper functions

function chunkSubstr(str, size) {
  const chunks = [];
  let i = 0;

  if (str.length < size) return [str];

  while (str.length>0){
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
    
    if (chunks.length === 1){
      bot.sendMessage(chatid, chunks[0], options);
      return;
    }

    for (let index = 0; index < chunks.length; index++) {
      bot.sendMessage(chatid, `{${index + 1} часть}
${chunks[index]}
{Конец части ${index + 1}}`, options);
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

  bot.onText = function (...args) {
    let originalRegex = args[0];
    let originalFunc = args[1];

    args[0] = new RegExp(
      originalRegex
        .toString()
        .substring(1, originalRegex.toString().length - 1)
        .replace("$", `${addedModifiersString}$`)
    );
    args[1] = function (...funcargs) {
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

      originalFunc.call(this, ...funcargs);

      mode = oldmode;
    };

    onTextOriginal.call(this, ...args);
  };
}

function disableNotificationsByDefault(bot){
  let sendMessageOriginal = bot.sendMessage;

  bot.sendMessage = async function (...args) {
    if (!args[2]) args[2] = {};
    args[2].disable_notification = true;
    return sendMessageOriginal.call(this, ...args);
  };
}

function addSavingLastMessages(bot){
  let sendMessageOriginal = bot.sendMessage;
  let sendPhotoOriginal = bot.sendPhoto;

  bot.sendMessage = async function (...args) {
    let chatId = args[0];
    let message = await sendMessageOriginal.call(this, ...args);
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

function tag() {
  return mode.nomention ? "" : "@";
}

function needCommands() {
  return !mode.nocommands;
}

function* popLast(chatId, count){
  for (let index = 0; index < count; index++) {
    if (!history[chatId]) return [];
    yield history[chatId].pop()
  }
}

module.exports = {
  mode,
  initGlobalModifiers,
  tag,
  popLast,
  needCommands,
  addLongCommands,
  disableNotificationsByDefault,
  addSavingLastMessages
};
