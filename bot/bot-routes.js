// eslint-disable-next-line no-unused-vars
const { HackerEmbassyBot } = require("./HackerEmbassyBot");

const BasicHandlers = require("./handlers/basic");
const StatusHandlers = require("./handlers/status");
const FundsHandlers = require("./handlers/funds");
const NeedsHandlers = require("./handlers/needs");
const EmbassyHandlers = require("./handlers/embassy");
const BirthdayHandlers = require("./handlers/birthday");
const AdminHandlers = require("./handlers/admin");
const ServiceHandlers = require("./handlers/service");
const MemeHandlers = require("./handlers/meme");

/**
 * @param {HackerEmbassyBot} bot
 */
function setRoutes(bot) {
    bot.onTextExt(/^\/(help)(@.+?)?$/i, BasicHandlers.helpHandler);
    bot.onTextExt(/^\/(about)(@.+?)?$/i, BasicHandlers.aboutHandler);
    bot.onTextExt(/^\/(join)(@.+?)?$/i, BasicHandlers.joinHandler);
    bot.onTextExt(/^\/(donate)(@.+?)?$/i, BasicHandlers.donateHandler);
    bot.onTextExt(/^\/(location|where)(@.+?)?$/i, BasicHandlers.locationHandler);
    bot.onTextExt(/^\/donate(cash|card)(@.+?)?$/i, BasicHandlers.donateCardHandler);
    bot.onTextExt(/^\/donate(btc|eth|usdc|usdt)(@.+?)?$/i, (bot, msg, match) =>
        BasicHandlers.donateCoinHandler(bot, msg, match[1])
    );
    bot.onTextExt(/^\/issue(@.+?)?(?: (.*))?$/i, (bot, msg, match) => BasicHandlers.issueHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/(getresidents|gr)(@.+?)?$/i, BasicHandlers.getResidentsHandler);
    bot.onTextExt(/^\/(start|startpanel|sp)(@.+?)?$/i, (bot, msg) => BasicHandlers.startPanelHandler(bot, msg));
    bot.onTextExt(/^\/(infopanel|ip)(@.+?)?$/i, (bot, msg) => BasicHandlers.infoPanelHandler(bot, msg));
    bot.onTextExt(/^\/(controlpanel|cp)(@.+?)?$/i, (bot, msg) => BasicHandlers.controlPanelHandler(bot, msg));

    bot.onTextExt(/^\/(status|s)(@.+?)?$/i, (bot, msg) => StatusHandlers.statusHandler(bot, msg));
    bot.onTextExt(/^\/in(@.+?)?$/i, StatusHandlers.inHandler);
    bot.onTextExt(/^\/(open|o)(@.+?)?$/i, StatusHandlers.openHandler);
    bot.onTextExt(/^\/(close|c)(@.+?)?$/i, StatusHandlers.closeHandler);
    bot.onTextExt(/^\/inforce(@.+?)? (\S+)$/i, (bot, msg, match) => StatusHandlers.inForceHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/outforce(@.+?)? (\S+)$/i, (bot, msg, match) => StatusHandlers.outForceHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/out(@.+?)?$/i, StatusHandlers.outHandler);
    bot.onTextExt(/^\/(evict|outforceall)(@.+?)?$/i, StatusHandlers.evictHandler);
    bot.onTextExt(/^\/autoinside(@.+?)?(?: (.*\S))?$/i, async (bot, msg, match) =>
        StatusHandlers.autoinsideHandler(bot, msg, match[2])
    );
    bot.onTextExt(/^\/setmac(@.+?)?(?: (.*\S))?$/i, async (bot, msg, match) => StatusHandlers.setmacHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/(going|g)(@.+?)?$/i, StatusHandlers.goingHandler);
    bot.onTextExt(/^\/(notgoing|ng)(@.+?)?$/i, StatusHandlers.notGoingHandler);
    bot.onTextExt(/^\/(?:setemoji|emoji|myemoji)(@.+?)?(?: (.*))?$/i, (bot, msg, match) =>
        StatusHandlers.setemojiHandler(bot, msg, match[2])
    );

    bot.onTextExt(/^\/(webcam|firstfloor|ff)(@.+?)?$/i, EmbassyHandlers.webcamHandler);
    bot.onTextExt(/^\/(webcam2|secondfloor|sf)(@.+?)?$/i, EmbassyHandlers.webcam2Handler);
    bot.onTextExt(/^\/(doorcam|dc)(@.+?)?$/i, EmbassyHandlers.doorcamHandler);
    bot.onTextExt(/^\/(printers)(@.+?)?$/i, EmbassyHandlers.printersHandler);
    bot.onTextExt(/^\/(anette|anettestatus)(@.+?)?$/i, (bot, msg) => EmbassyHandlers.printerStatusHandler(bot, msg, "anette"));
    bot.onTextExt(/^\/(plumbus|plumbusstatus)(@.+?)?$/i, (bot, msg) => EmbassyHandlers.printerStatusHandler(bot, msg, "plumbus"));
    bot.onTextExt(/^\/printerstatus(@.+?)? (.*\S)$/i, (bot, msg, match) =>
        EmbassyHandlers.printerStatusHandler(bot, msg, match[2])
    );
    bot.onTextExt(/^\/(unlock|u)(@.+?)?$/i, EmbassyHandlers.unlockHandler);
    bot.onTextExt(/^\/(doorbell|db)(@.+?)?$/i, EmbassyHandlers.doorbellHandler);
    bot.onTextExt(/^\/monitor(@.+?)?$/i, (bot, msg) => EmbassyHandlers.monitorHandler(bot, msg, false));
    bot.onTextExt(/^\/(?:sayinspace|say)(@.+?)?(?: (.*))?$/ims, (bot, msg, match) =>
        EmbassyHandlers.sayinspaceHandler(bot, msg, match[2])
    );
    bot.onTextExt(/^\/(?:playinspace|play)(@.+?)?(?: (.*))?$/ims, (bot, msg, match) =>
        EmbassyHandlers.playinspaceHandler(bot, msg, match[2])
    );
    bot.onTextExt(/^\/(fartinspace|fart)(@.+?)?$/i, (bot, msg) =>
        EmbassyHandlers.playinspaceHandler(bot, msg, "https://www.tones7.com/media/farts.mp3")
    );
    bot.onTextExt(/^\/(moaninspace|moan)(@.+?)?$/i, (bot, msg) =>
        EmbassyHandlers.playinspaceHandler(bot, msg, "http://soundjax.com/reddo/24227%5EMOAN.mp3")
    );
    bot.onTextExt(/^\/(rickroll|nevergonnagiveyouup)(@.+?)?$/i, (bot, msg) =>
        EmbassyHandlers.playinspaceHandler(bot, msg, "http://le-fail.lan:8001/rickroll.mp3")
    );

    bot.onTextExt(/^\/funds(@.+?)?$/i, FundsHandlers.fundsHandler);
    bot.onTextExt(/^\/fund(@.+?)? (.*\S)$/i, (bot, msg, match) => FundsHandlers.fundHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/fundsall(@.+?)?$/i, FundsHandlers.fundsallHandler);
    bot.onTextExt(/^\/addfund(@.+?)? (.*\S) with target (\d+(?:k|тыс|тысяч|т)?)\s?(\D*)$/i, (bot, msg, match) =>
        FundsHandlers.addFundHandler(bot, msg, match[2], match[3], match[4])
    );
    bot.onTextExt(
        /^\/updatefund(@.+?)? (.*\S) with target (\d+(?:k|тыс|тысяч|т)?)\s?(\D*?)(?: as (.*\S))?$/i,
        (bot, msg, match) => FundsHandlers.updateFundHandler(bot, msg, match[2], match[3], match[4], match[5])
    );
    bot.onTextExt(/^\/removefund(@.+?)? (.*\S)$/i, (bot, msg, match) => FundsHandlers.removeFundHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/exportfund(@.+?)? (.*\S)$/i, async (bot, msg, match) => FundsHandlers.exportCSVHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/exportdonut(@.+?)? (.*\S)$/i, async (bot, msg, match) =>
        FundsHandlers.exportDonutHandler(bot, msg, match[2])
    );
    bot.onTextExt(/^\/closefund(@.+?)? (.*\S)$/i, (bot, msg, match) => FundsHandlers.closeFundHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/changefundstatus(@.+?)? of (.*\S) to (.*\S)$/i, (bot, msg, match) =>
        FundsHandlers.changeFundStatusHandler(bot, msg, match[2], match[3])
    );
    bot.onTextExt(/^\/adddonation(@.+?)? (\d+(?:k|тыс|тысяч|т)?)\s?(\D*?) from (\S+?) to (.*\S)$/i, (bot, msg, match) =>
        FundsHandlers.addDonationHandler(bot, msg, match[2], match[3], match[4], match[5])
    );
    bot.onTextExt(/^\/costs(@.+?)? (\d+(?:k|тыс|тысяч|т)?)\s?(\D*?) from (\S+?)(\s.*)?$/i, (bot, msg, match) =>
        FundsHandlers.costsHandler(bot, msg, match[2], match[3], match[4])
    );
    bot.onTextExt(/^\/(showcosts|costs)(@.+?)?$/i, (bot, msg) => FundsHandlers.showCostsHandler(bot, msg));
    bot.onTextExt(/^\/(showcostsdonut|costsdonut|donut)(@.+?)?$/i, (bot, msg) => FundsHandlers.showCostsDonutHandler(bot, msg));
    bot.onTextExt(/^\/removedonation(@.+?)? (\d+)$/i, (bot, msg, match) =>
        FundsHandlers.removeDonationHandler(bot, msg, match[2])
    );
    bot.onTextExt(/^\/transferdonation(@.+?)? (\d+) to (.*\S)$/i, (bot, msg, match) =>
        FundsHandlers.transferDonationHandler(bot, msg, match[2], match[3])
    );
    bot.onTextExt(/^\/changedonation(@.+?)? (\d+) to (\S+)\s?(\D*?)$/i, (bot, msg, match) =>
        FundsHandlers.changeDonationHandler(bot, msg, match[2], match[3], match[4])
    );

    bot.onTextExt(/^\/needs(@.+?)?$/i, NeedsHandlers.needsHandler);
    bot.onTextExt(/^\/(?:buy|need)(@.+?)? (.*)$/i, (bot, msg, match) => NeedsHandlers.buyHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/bought(@.+?)? (.*)$/i, (bot, msg, match) => NeedsHandlers.boughtHandler(bot, msg, match[2]));

    bot.onTextExt(/^\/birthdays(@.+?)?$/i, async (bot, msg) => BirthdayHandlers.birthdayHandler(bot, msg));
    bot.onTextExt(/^\/(forcebirthdaywishes|fbw)(@.+?)?$/i, async (bot, msg) =>
        BirthdayHandlers.forceBirthdayWishHandler(bot, msg)
    );
    bot.onTextExt(/^\/mybirthday(@.+?)?(?: (.*\S)?)?$/i, async (bot, msg, match) =>
        BirthdayHandlers.myBirthdayHandler(bot, msg, match[2])
    );

    bot.onTextExt(/^\/(getusers|gu)(@.+?)?$/i, AdminHandlers.getUsersHandler);
    bot.onTextExt(/^\/adduser(@.+?)? (\S+?) as (\S+)$/i, (bot, msg, match) =>
        AdminHandlers.addUserHandler(bot, msg, match[2], match[3])
    );
    bot.onTextExt(/^\/updateroles(@.+?)? of (\S+?) to (\S+)$/i, (bot, msg, match) =>
        AdminHandlers.updateRolesHandler(bot, msg, match[2], match[3])
    );
    bot.onTextExt(/^\/removeuser(@.+?)? (\S+)$/i, (bot, msg, match) => AdminHandlers.removeUserHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/forward(@.+?)? (.*)$/i, (bot, msg, match) => AdminHandlers.forwardHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/(getlogs|logs)(@.+?)?$/i, AdminHandlers.getLogHandler);

    bot.onTextExt(/^\/randomdog(@.+?)?$/i, MemeHandlers.randomDogHandler);
    bot.onTextExt(/^\/randomcat(@.+?)?$/i, MemeHandlers.randomCatHandler);
    bot.onTextExt(/^\/(randomcab|givemecab|iwantcab|ineedcab|iwanttoseecab)(@.+?)?$/i, MemeHandlers.randomCabHandler);

    bot.onTextExt(/^\/clear(@.+?)?(?: (\d*))?$/i, (bot, msg, match) => ServiceHandlers.clearHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/(superstatus|ss)(@.+?)?$/i, ServiceHandlers.superstatusHandler);
    bot.onExt("callback_query", ServiceHandlers.callbackHandler);
    bot.on("new_chat_members", ServiceHandlers.newMemberHandler);
}

module.exports = { setRoutes };
