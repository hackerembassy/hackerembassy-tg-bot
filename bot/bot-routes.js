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
const MemeHandlers = new (require("./handlers/meme"))();

bot.onText(/^\/(help)(@.+?)?$/i, BasicHandlers.helpHandler);
bot.onText(/^\/(about)(@.+?)?$/i, BasicHandlers.aboutHandler);
bot.onText(/^\/(join)(@.+?)?$/i, BasicHandlers.joinHandler);
bot.onText(/^\/(donate)(@.+?)?$/i, BasicHandlers.donateHandler);
bot.onText(/^\/(location|where)(@.+?)?$/i, BasicHandlers.locationHandler);
bot.onText(/^\/donate(cash|card)(@.+?)?$/i, BasicHandlers.donateCardHandler);
bot.onText(/^\/donate(btc|eth|usdc|usdt)(@.+?)?$/i, (msg, match) => BasicHandlers.donateCoinHandler(msg, match[1]));
bot.onText(/^\/issue(@.+?)?(?: (.*))?$/i, (msg, match) => BasicHandlers.issueHandler(msg, match[2]));
bot.onText(/^\/(getresidents|gr)(@.+?)?$/i, BasicHandlers.getResidentsHandler);
bot.onText(/^\/(start|startpanel|sp)(@.+?)?$/i, (msg) => BasicHandlers.startPanelHandler(msg));
bot.onText(/^\/(infopanel|ip)(@.+?)?$/i, (msg) => BasicHandlers.infoPanelHandler(msg));
bot.onText(/^\/(controlpanel|cp)(@.+?)?$/i, (msg) => BasicHandlers.controlPanelHandler(msg));

bot.onText(/^\/(status|s)(@.+?)?$/i, (msg) => StatusHandlers.statusHandler(msg));
bot.onText(/^\/in(@.+?)?$/i, StatusHandlers.inHandler);
bot.onText(/^\/(open|o)(@.+?)?$/i, StatusHandlers.openHandler);
bot.onText(/^\/(close|c)(@.+?)?$/i, StatusHandlers.closeHandler);
bot.onText(/^\/inforce(@.+?)? (\S+)$/i, (msg, match) => StatusHandlers.inForceHandler(msg, match[2]));
bot.onText(/^\/outforce(@.+?)? (\S+)$/i, (msg, match) => StatusHandlers.outForceHandler(msg, match[2]));
bot.onText(/^\/out(@.+?)?$/i, StatusHandlers.outHandler);
bot.onText(/^\/autoinside(@.+?)?(?: (.*\S))?$/i, async (msg, match) => StatusHandlers.autoinsideHandler(msg, match[2]));
bot.onText(/^\/setmac(@.+?)?(?: (.*\S))?$/i, async (msg, match) => StatusHandlers.setmacHandler(msg, match[2]));
bot.onText(/^\/(going|g)(@.+?)?$/i, StatusHandlers.goingHandler);
bot.onText(/^\/(notgoing|ng)(@.+?)?$/i, StatusHandlers.notGoingHandler);

bot.onText(/^\/(webcam|firstfloor|ff)(@.+?)?$/i, EmbassyHandlers.webcamHandler);
bot.onText(/^\/(webcam2|secondfloor|sf)(@.+?)?$/i, EmbassyHandlers.webcam2Handler);
bot.onText(/^\/(doorcam|dc)(@.+?)?$/i, EmbassyHandlers.doorcamHandler);
bot.onText(/^\/(printer|anette)(@.+?)?$/i, EmbassyHandlers.printerHandler);
bot.onText(/^\/(printerstatus|anettestatus)(@.+?)?$/i, EmbassyHandlers.printerStatusHandler);
bot.onText(/^\/(unlock|u)(@.+?)?$/i, EmbassyHandlers.unlockHandler);
bot.onText(/^\/(doorbell|db)(@.+?)?$/i, EmbassyHandlers.doorbellHandler);
bot.onText(/^\/monitor(@.+?)?$/i, EmbassyHandlers.monitorHandler);

bot.onText(/^\/funds(@.+?)?$/i, FundsHandlers.fundsHandler);
bot.onText(/^\/fund(@.+?)? (.*\S)$/i, (msg, match) => FundsHandlers.fundHandler(msg, match[2]));
bot.onText(/^\/fundsall(@.+?)?$/i, FundsHandlers.fundsallHandler);
bot.onText(/^\/addfund(@.+?)? (.*\S) with target (\d+(?:k|тыс|тысяч|т)?)\s?(\D*)$/i, (msg, match) => FundsHandlers.addFundHandler(msg, match[2], match[3], match[4]));
bot.onText(/^\/updatefund(@.+?)? (.*\S) with target (\d+(?:k|тыс|тысяч|т)?)\s?(\D*?)(?: as (.*\S))?$/i, (msg, match) => FundsHandlers.updateFundHandler(msg, match[2], match[3], match[4], match[5]));
bot.onText(/^\/removefund(@.+?)? (.*\S)$/i, (msg, match) => FundsHandlers.removeFundHandler(msg, match[2]));
bot.onText(/^\/exportfund(@.+?)? (.*\S)$/i, async (msg, match) => FundsHandlers.exportCSVHandler(msg, match[2]));
bot.onText(/^\/exportdonut(@.+?)? (.*\S)$/i, async (msg, match) => FundsHandlers.exportDonutHandler(msg, match[2]));
bot.onText(/^\/closefund(@.+?)? (.*\S)$/i, (msg, match) => FundsHandlers.closeFundHandler(msg, match[2]));
bot.onText(/^\/changefundstatus(@.+?)? of (.*\S) to (.*\S)$/i, (msg, match) => FundsHandlers.changeFundStatusHandler(msg, match[2], match[3]));
bot.onText(/^\/adddonation(@.+?)? (\d+(?:k|тыс|тысяч|т)?)\s?(\D*?) from (\S+?) to (.*\S)$/i, (msg, match) => FundsHandlers.addDonationHandler(msg, match[2], match[3], match[4], match[5]));
bot.onText(/^\/costs(@.+?)? (\d+(?:k|тыс|тысяч|т)?)\s?(\D*?) from (\S+?)(\s.*)?$/i, (msg, match) => FundsHandlers.costsHandler(msg, match[2], match[3], match[4]));
bot.onText(/^\/removedonation(@.+?)? (\d+)$/i, (msg, match) => FundsHandlers.removeDonationHandler(msg, match[2]));
bot.onText(/^\/transferdonation(@.+?)? (\d+) to (.*\S)$/i, (msg, match) => FundsHandlers.transferDonationHandler(msg, match[2], match[3]));
bot.onText(/^\/changedonation(@.+?)? (\d+) to (\S+)\s?(\D*?)$/i, (msg, match) => FundsHandlers.changeDonationHandler(msg, match[2], match[3], match[4]));

bot.onText(/^\/needs(@.+?)?$/i, NeedsHandlers.needsHandler);
bot.onText(/^\/(?:buy|need)(@.+?)? (.*)$/i, (msg, match) => NeedsHandlers.buyHandler(msg, match[2]));
bot.onText(/^\/bought(@.+?)? (.*)$/i, (msg, match) => NeedsHandlers.boughtHandler(msg, match[2]));

bot.onText(/^\/birthdays(@.+?)?$/i, async (msg) => BirthdayHandlers.birthdayHandler(msg));
bot.onText(/^\/(forcebirthdaywishes|fbw)(@.+?)?$/i, async (msg) => BirthdayHandlers.forceBirthdayWishHandler(msg));
bot.onText(/^\/mybirthday(@.+?)?(?: (.*\S)?)?$/i, async (msg, match) => BirthdayHandlers.myBirthdayHandler(msg, match[2]));

bot.onText(/^\/(getusers|gu)(@.+?)?$/i, AdminHandlers.getUsersHandler);
bot.onText(/^\/adduser(@.+?)? (\S+?) as (\S+)$/i, (msg, match) => AdminHandlers.addUserHandler(msg, match[2], match[3]));
bot.onText(/^\/updateroles(@.+?)? of (\S+?) to (\S+)$/i, (msg, match) => AdminHandlers.updateRolesHandler(msg, match[2], match[3]));
bot.onText(/^\/removeuser(@.+?)? (\S+)$/i, (msg, match) => AdminHandlers.removeUserHandler(msg, match[2]));
bot.onText(/^\/forward(@.+?)? (.*)$/i, (msg, match) => AdminHandlers.forwardHandler(msg, match[2]));
bot.onText(/^\/(getlogs|logs)(@.+?)?$/i, AdminHandlers.getLogHandler);

bot.onText(/^\/randomdog(@.+?)?$/i, MemeHandlers.randomDogHandler);
bot.onText(/^\/randomcat(@.+?)?$/i, MemeHandlers.randomCatHandler);
bot.onText(/^\/(randomcab|givemecab|iwantcab|ineedcab|iwanttoseecab)(@.+?)?$/i, MemeHandlers.randomCabHandler);

bot.onText(/^\/clear(@.+?)?(?: (\d*))?$/i, (msg, match) => ServiceHandlers.clearHandler(msg, match[2]));
bot.onText(/^\/(superstatus|ss)(@.+?)?$/i, ServiceHandlers.superstatusHandler);
bot.on("callback_query", ServiceHandlers.callbackHandler);
bot.on("new_chat_members", ServiceHandlers.newMemberHandler);

logger.info(`Bot is ready to accept commands`);