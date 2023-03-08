const bot = require("./bot");
const logger = require("../services/logger");
const BasicHandlers = new (require("./handlers/basic"))();
const StatusHandlers = new (require("./handlers/status"))();
const FundsHandlers = new (require("./handlers/funds"))();
const NeedsHandlers = new (require("./handlers/needs"))();
const EmbassyHandlers = new (require("./handlers/embassy"))();
const BirthdayHandlers = new (require("./handlers/birthday"))();
const AdminHandlers = new (require("./handlers/admin"))();
const ServiceHandlers = new (require("./handlers/service"))();

bot.onText(/^\/(start|help)(@.+?)?$/, BasicHandlers.startHandler);
bot.onText(/^\/(about)(@.+?)?$/, BasicHandlers.aboutHandler);
bot.onText(/^\/(join)(@.+?)?$/, BasicHandlers.joinHandler);
bot.onText(/^\/(donate)(@.+?)?$/, BasicHandlers.donateHandler);
bot.onText(/^\/location(@.+?)?$/, BasicHandlers.locationHandler);
bot.onText(/^\/donate(Cash|Card)(@.+?)?$/, BasicHandlers.donateCardHandler);
bot.onText(/^\/donate(BTC|ETH|USDC|USDT)(@.+?)?$/, (msg, match) => BasicHandlers.donateCoinHandler(msg, match[1]));
bot.onText(/^\/getresidents(@.+?)?$/, BasicHandlers.getResidentsHandler);

bot.onText(/^\/status(@.+?)?$/, (msg) => StatusHandlers.statusHandler(msg));
bot.onText(/^\/in(@.+?)?$/, StatusHandlers.inHandler);
bot.onText(/^\/open(@.+?)?$/, StatusHandlers.openHandler);
bot.onText(/^\/close(@.+?)?$/, StatusHandlers.closeHandler);
bot.onText(/^\/inForce(@.+?)? (\S+)$/, (msg, match) => StatusHandlers.inForceHandler(msg, match[2]));
bot.onText(/^\/outForce(@.+?)? (\S+)$/, (msg, match) => StatusHandlers.outForceHandler(msg, match[2]));
bot.onText(/^\/out(@.+?)?$/, StatusHandlers.outHandler);
bot.onText(/^\/autoinside(@.+?)?(?: (.*\S))?$/, async (msg, match) => StatusHandlers.autoinsideHandler(msg, match[2]));
bot.onText(/^\/going(@.+?)?$/, StatusHandlers.goingHandler);
bot.onText(/^\/notgoing(@.+?)?$/, StatusHandlers.notGoingHandler);

bot.onText(/^\/(webcam)(@.+?)?$/, EmbassyHandlers.webcamHandler);
bot.onText(/^\/(printer)(@.+?)?$/, EmbassyHandlers.printerHandler);
bot.onText(/^\/(printerstatus)(@.+?)?$/, EmbassyHandlers.printerStatusHandler);
bot.onText(/^\/unlock(@.+?)?$/, EmbassyHandlers.unlockHandler);
bot.onText(/^\/doorbell(@.+?)?$/, EmbassyHandlers.doorbellHandler);

bot.onText(/^\/funds(@.+?)?$/, FundsHandlers.fundsHandler);
bot.onText(/^\/fund(@.+?)? (.*\S)$/, (msg, match) => FundsHandlers.fundHandler(msg, match[2]));
bot.onText(/^\/fundsall(@.+?)?$/, FundsHandlers.fundsallHandler);
bot.onText(/^\/addFund(@.+?)? (.*\S) with target (\S+)\s?(\D*)$/, (msg, match) => FundsHandlers.addFundHandler(msg, match[2], match[3], match[4]));
bot.onText(/^\/updateFund(@.+?)? (.*\S) with target (\S+)\s?(\D*?)(?: as (.*\S))?$/, (msg, match) => FundsHandlers.updateFundHandler(msg, match[2], match[3], match[4], match[5]));
bot.onText(/^\/removeFund(@.+?)? (.*\S)$/, (msg, match) => FundsHandlers.removeFundHandler(msg, match[2]));
bot.onText(/^\/exportFund(@.+?)? (.*\S)$/, async (msg, match) => FundsHandlers.exportFundHandler(msg, match[2]));
bot.onText(/^\/exportDonut(@.+?)? (.*\S)$/, async (msg, match) => FundsHandlers.exportDonutHandler(msg, match[2]));
bot.onText(/^\/closeFund(@.+?)? (.*\S)$/, (msg, match) => FundsHandlers.closeFundHandler(msg, match[2]));
bot.onText(/^\/changeFundStatus(@.+?)? of (.*\S) to (.*\S)$/, (msg, match) => FundsHandlers.changeFundStatusHandler(msg, match[2], match[3]));
bot.onText(/^\/addDonation(@.+?)? (\S+)\s?(\D*?) from (\S+?) to (.*\S)$/, (msg, match) => FundsHandlers.addDonationHandler(msg, match[2], match[3], match[4], match[5]));
bot.onText(/^\/costs(@.+?)? (\S+)\s?(\D*?) from (\S+?)$/, (msg, match) => FundsHandlers.costsHandler(msg, match[2], match[3], match[4]));
bot.onText(/^\/removeDonation(@.+?)? (\d+)$/, (msg, match) => FundsHandlers.removeDonationHandler(msg, match[2]));
bot.onText(/^\/transferDonation(@.+?)? (\d+) to (.*\S)$/, (msg, match) => FundsHandlers.transferDonationHandler(msg, match[2], match[3]));
bot.onText(/^\/changeDonation(@.+?)? (\d+) to (\S+)\s?(\D*?)$/, (msg, match) => FundsHandlers.changeDonationHandler(msg, match[2], match[3], match[4]));

bot.onText(/^\/needs(@.+?)?$/, NeedsHandlers.needsHandler);
bot.onText(/^\/(?:buy|need)(@.+?)? (.*)$/, (msg, match) => NeedsHandlers.buyHandler(msg, match[2]));
bot.onText(/^\/bought(@.+?)? (.*)$/, (msg, match) => NeedsHandlers.boughtHandler(msg, match[2]));

bot.onText(/^\/birthdays(@.+?)?$/, async (msg) => BirthdayHandlers.birthdayHandler(msg));
bot.onText(/^\/forcebirthdaywishes(@.+?)?$/, async (msg) => BirthdayHandlers.forceBirthdayWishHandler(msg));
bot.onText(/^\/mybirthday(@.+?)?(?: (.*\S)?)?$/, async (msg, match) => BirthdayHandlers.myBirthdayHandler(msg, match[2]));

bot.onText(/^\/getusers(@.+?)?$/, AdminHandlers.getUsersHandler);
bot.onText(/^\/adduser(@.+?)? (\S+?) as (\S+)$/, (msg, match) => AdminHandlers.addUserHandler(msg, match[2], match[3]));
bot.onText(/^\/updateroles(@.+?)? of (\S+?) to (\S+)$/, (msg, match) => AdminHandlers.updateRolesHandler(msg, match[2], match[3]));
bot.onText(/^\/removeuser(@.+?)? (\S+)$/, (msg, match) => AdminHandlers.removeUserHandler(msg, match[2]));
bot.onText(/^\/forward(@.+?)? (.*)$/, (msg, match) => AdminHandlers.forwardHandler(msg, match[2]));
bot.onText(/^\/getlog(@.+?)?$/, AdminHandlers.getLogHandler);

bot.onText(/^\/clear(@.+?)?(?: (\d*))?$/, (msg, match) => ServiceHandlers.clearHandler(msg, match[2]));
bot.on("callback_query", ServiceHandlers.callbackHandler);
bot.on("new_chat_members", ServiceHandlers.newMemberHandler);

logger.info(`Bot is ready to accept commands`);