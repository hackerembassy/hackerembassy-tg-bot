const TelegramBot = require("node-telegram-bot-api");
const config = require("config");
const botConfig = config.get("bot");
const {
  initGlobalModifiers,
  addLongCommands,
  addSavingLastMessages,
  makeAllMessagesMarkdown,
  enableAutoWishes,
  extendWithFormatUserName,
  extendWithIsAdminMode,
  enablePaymentNotifications
} = require("./botExtensions");

process.env.TZ = botConfig.timezone;

const TOKEN = process.env["HACKERBOTTOKEN"];
const IsDebug = process.env["BOTDEBUG"] === "true";
const bot = new TelegramBot(TOKEN, { polling: true });

// Apply extensions to the bot
initGlobalModifiers(bot);
addLongCommands(bot);
extendWithFormatUserName(bot);
extendWithIsAdminMode(bot);
addSavingLastMessages(bot);
makeAllMessagesMarkdown(bot);
enablePaymentNotifications(bot);
if (botConfig.autoWish) enableAutoWishes(bot);

// Debug echoing of received messages
IsDebug &&
  bot.on("message", (msg) => {
    bot.sendMessage(msg.chat.id, `Debug: Received from ${msg.chat.id} message ${msg.text}`);
  });

module.exports = bot;
