const maxChunkSize = 3000;
const messagedelay = 1500;

let mode = {
  silent: false,
  nomention: false,
  nocommands: false,
};

// Helper functions

function chunkSubstr(str, size) {
  const numChunks = Math.ceil(str.length / size);
  const chunks = new Array(numChunks);

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size);
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

  bot.sendMessage = function (...args) {
    if (!mode.silent) {
      sendMessageOriginal.call(this, ...args);
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

// Public extension related functions

function tag() {
  return mode.nomention ? "" : "@";
}

function needCommands() {
  return !mode.nocommands;
}

module.exports = {
  mode,
  initGlobalModifiers,
  tag,
  needCommands,
  addLongCommands,
};
