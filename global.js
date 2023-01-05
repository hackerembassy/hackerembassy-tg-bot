let mode = {
  silent: false,
  nomention: false,
};

function initGlobalModifiers(bot) {
  let addedModifiersString = Object.keys(mode).reduce((acc, key) => {
    return `${acc} -${key}|`;
  }, "(").replace(/\|$/,")*");

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
      if (funcargs[1] !== undefined) {
        funcargs[1] = originalRegex.exec(newCommand);
      }

      let oldmode = { ...mode };

      for (const modes of Object.keys(mode)) {
        if (match[0].includes(`-${mode}`)) 
            mode[key] = true;
      }

      originalFunc.call(this, ...funcargs);

      mode = oldmode;
    };
    onTextOriginal.call(this, ...args);
  };
}

function tag() {
  return mode.nomention ? "" : "@";
}

module.exports = { mode, initGlobalModifiers, tag };
