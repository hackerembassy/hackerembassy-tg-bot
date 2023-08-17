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

const logger = require("../services/logger");

class RegexCommander {
    /**
     * @param {string} botname
     */
    constructor(botname = "") {
        this.botname = botname;
    }

    /**
     * @param {string[]} aliases
     * @param {RegExp} params
     * @param {boolean} optional
     */
    command(aliases, params = undefined, optional = true, flags = "i") {
        const commandPart = `/(?:${aliases.join("|")})(?:@${this.botname})?`;
        const paramsPart = params ? (optional ? `(?: ${params.source})?` : ` ${params.source}`) : "";
        return new RegExp(`^${commandPart}${paramsPart}$`, flags);
    }
}

/**
 * @param {HackerEmbassyBot} bot
 */
async function setRoutes(bot) {
    const botname = (await bot.getMe()).username;
    const rc = new RegexCommander(botname);

    // Info
    bot.onTextExt(rc.command(["help"]), BasicHandlers.helpHandler);
    bot.onTextExt(rc.command(["about"]), BasicHandlers.aboutHandler);
    bot.onTextExt(rc.command(["join"]), BasicHandlers.joinHandler);
    bot.onTextExt(rc.command(["events"]), BasicHandlers.eventsHandler);
    bot.onTextExt(rc.command(["donate"]), BasicHandlers.donateHandler);
    bot.onTextExt(rc.command(["location", "where"]), BasicHandlers.locationHandler);
    bot.onTextExt(rc.command(["donatecash", "donatecard"]), BasicHandlers.donateCardHandler);
    bot.onTextExt(rc.command(["donatecrypto"], /(btc|eth|usdc|usdt)/, false), (bot, msg, match) =>
        BasicHandlers.donateCoinHandler(bot, msg, match[1])
    );
    bot.onTextExt(rc.command(["getresidents", "gr"]), BasicHandlers.getResidentsHandler);

    // Panels
    bot.onTextExt(rc.command(["start", "startpanel", "sp"]), (bot, msg) => BasicHandlers.startPanelHandler(bot, msg));
    bot.onTextExt(rc.command(["infopanel", "ip"]), (bot, msg) => BasicHandlers.infoPanelHandler(bot, msg));
    bot.onTextExt(rc.command(["controlpanel", "cp"]), (bot, msg) => BasicHandlers.controlPanelHandler(bot, msg));

    // Issues
    bot.onTextExt(rc.command(["issue"], /(.*)/), (bot, msg, match) => BasicHandlers.issueHandler(bot, msg, match[1]));

    // Status
    bot.onTextExt(rc.command(["status", "s"]), (bot, msg) => StatusHandlers.statusHandler(bot, msg));
    bot.onTextExt(rc.command(["in", "iaminside"]), StatusHandlers.inHandler);
    bot.onTextExt(rc.command(["open", "o"]), StatusHandlers.openHandler);
    bot.onTextExt(rc.command(["close", "c"]), StatusHandlers.closeHandler);
    bot.onTextExt(rc.command(["inforce", "goin"], /(\S+)/, false), (bot, msg, match) =>
        StatusHandlers.inForceHandler(bot, msg, match[1])
    );
    bot.onTextExt(rc.command(["outforce", "gohome"], /(\S+)/, false), (bot, msg, match) =>
        StatusHandlers.outForceHandler(bot, msg, match[1])
    );
    bot.onTextExt(rc.command(["out", "iamleaving"]), StatusHandlers.outHandler);
    bot.onTextExt(rc.command(["evict", "outforceall"]), StatusHandlers.evictHandler);
    bot.onTextExt(rc.command(["going", "g"], /(.*)/), (bot, msg, match) => StatusHandlers.goingHandler(bot, msg, match[1]));
    bot.onTextExt(rc.command(["notgoing", "ng"]), StatusHandlers.notGoingHandler);
    bot.onTextExt(rc.command(["autoinside"], /(.*\S)/), async (bot, msg, match) =>
        StatusHandlers.autoinsideHandler(bot, msg, match[1])
    );
    bot.onTextExt(rc.command(["setmac"], /(?:(.*\S))/), async (bot, msg, match) =>
        StatusHandlers.setmacHandler(bot, msg, match[1])
    );
    bot.onTextExt(/^\/(superstatus|ss)(@.+?)?$/i, ServiceHandlers.superstatusHandler);

    // Stats
    bot.onTextExt(rc.command(["mystats"]), (bot, msg) => StatusHandlers.statsOfHandler(bot, msg));
    bot.onTextExt(rc.command(["statsof"], /(\S+)/, false), (bot, msg, match) =>
        StatusHandlers.statsOfHandler(bot, msg, match[3])
    );
    bot.onTextExt(rc.command(["stats"], /(?:from (\S+))?(?: to (\S+))?/, false), (bot, msg, match) =>
        StatusHandlers.statsHandler(bot, msg, match[1], match[2])
    );
    bot.onTextExt(rc.command(["month", "statsmonth", "monthstats"]), (bot, msg) => StatusHandlers.statsMonthHandler(bot, msg));
    bot.onTextExt(rc.command(["lastmonth", "statslastmonth", "lastmonthstats"]), (bot, msg) =>
        StatusHandlers.statsMonthHandler(bot, msg, new Date().getMonth() - 1)
    );

    // Emoji
    bot.onTextExt(rc.command(["setemoji", "emoji", "myemoji"], /(.*)/), (bot, msg, match) =>
        StatusHandlers.setemojiHandler(bot, msg, match[1])
    );

    // Cams
    bot.onTextExt(rc.command(["webcam", "webcum", "cam", "cum", "firstfloor", "ff"]), EmbassyHandlers.webcamHandler);
    bot.onTextExt(rc.command(["webcam2", "webcum2", "cam2", "cum2", "secondfloor", "sf"]), EmbassyHandlers.webcam2Handler);
    bot.onTextExt(rc.command(["doorcam", "doorcum", "dc"]), EmbassyHandlers.doorcamHandler);

    // Sensors
    bot.onTextExt(rc.command(["climate"]), EmbassyHandlers.climateHandler);

    // Printers
    bot.onTextExt(rc.command(["printers"]), EmbassyHandlers.printersHandler);
    bot.onTextExt(rc.command(["anette", "anettestatus"]), (bot, msg) => EmbassyHandlers.printerStatusHandler(bot, msg, "anette"));
    bot.onTextExt(rc.command(["plumbus", "plumbusstatus"]), (bot, msg) =>
        EmbassyHandlers.printerStatusHandler(bot, msg, "plumbus")
    );
    bot.onTextExt(rc.command(["printerstatus"], /(.*\S)/, false), (bot, msg, match) =>
        EmbassyHandlers.printerStatusHandler(bot, msg, match[1])
    );

    // Door
    bot.onTextExt(rc.command(["unlock", "u"]), EmbassyHandlers.unlockHandler);
    bot.onTextExt(rc.command(["doorbell", "db"]), EmbassyHandlers.doorbellHandler);

    // Monitoring
    bot.onTextExt(rc.command(["monitor"]), (bot, msg) => EmbassyHandlers.monitorHandler(bot, msg, false));

    // Sounds
    bot.onTextExt(rc.command(["sayinspace", "say"], /(.*)/, true, "ims"), (bot, msg, match) =>
        EmbassyHandlers.sayinspaceHandler(bot, msg, match[1])
    );
    bot.onTextExt(rc.command(["playinspace", "play"], /(.*)/, true, "ims"), (bot, msg, match) =>
        EmbassyHandlers.playinspaceHandler(bot, msg, match[1])
    );
    bot.onTextExt(rc.command(["fartinspace", "fart"]), (bot, msg) =>
        EmbassyHandlers.playinspaceHandler(bot, msg, "https://www.tones7.com/media/farts.mp3")
    );
    bot.onTextExt(rc.command(["moaninspace", "moan"]), (bot, msg) =>
        EmbassyHandlers.playinspaceHandler(bot, msg, "http://soundjax.com/reddo/24227%5EMOAN.mp3")
    );
    bot.onTextExt(rc.command(["rickroll", "nevergonnagiveyouup"]), (bot, msg) =>
        EmbassyHandlers.playinspaceHandler(bot, msg, "http://le-fail.lan:8001/rickroll.mp3")
    );

    // Funds and donations
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
    bot.onTextExt(/^\/(residents?(costs|donated))(@.+?)?$/i, (bot, msg) => FundsHandlers.residentsDonatedHandler(bot, msg));

    bot.onTextExt(/^\/removedonation(@.+?)? (\d+)$/i, (bot, msg, match) =>
        FundsHandlers.removeDonationHandler(bot, msg, match[2])
    );
    bot.onTextExt(/^\/transferdonation(@.+?)? (\d+) to (.*\S)$/i, (bot, msg, match) =>
        FundsHandlers.transferDonationHandler(bot, msg, match[2], match[3])
    );
    bot.onTextExt(/^\/changedonation(@.+?)? (\d+) to (\S+)\s?(\D*?)$/i, (bot, msg, match) =>
        FundsHandlers.changeDonationHandler(bot, msg, match[2], match[3], match[4])
    );

    // Needs
    bot.onTextExt(/^\/needs(@.+?)?$/i, NeedsHandlers.needsHandler);
    bot.onTextExt(/^\/(?:buy|need)(@.+?)? (.*)$/i, (bot, msg, match) => NeedsHandlers.buyHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/bought(@.+?)? (.*)$/i, (bot, msg, match) => NeedsHandlers.boughtHandler(bot, msg, match[2]));

    // Birthdays
    bot.onTextExt(/^\/birthdays(@.+?)?$/i, async (bot, msg) => BirthdayHandlers.birthdayHandler(bot, msg));
    bot.onTextExt(/^\/(forcebirthdaywishes|fbw)(@.+?)?$/i, async (bot, msg) =>
        BirthdayHandlers.forceBirthdayWishHandler(bot, msg)
    );
    bot.onTextExt(/^\/mybirthday(@.+?)?(?: (.*\S)?)?$/i, async (bot, msg, match) =>
        BirthdayHandlers.myBirthdayHandler(bot, msg, match[2])
    );

    // Admin
    bot.onTextExt(/^\/(getusers|gu)(@.+?)?$/i, AdminHandlers.getUsersHandler);
    bot.onTextExt(/^\/adduser(@.+?)? (\S+?) as (\S+)$/i, (bot, msg, match) =>
        AdminHandlers.addUserHandler(bot, msg, match[2], match[3])
    );
    bot.onTextExt(/^\/updateroles(@.+?)? of (\S+?) to (\S+)$/i, (bot, msg, match) =>
        AdminHandlers.updateRolesHandler(bot, msg, match[2], match[3])
    );
    bot.onTextExt(/^\/removeuser(@.+?)? (\S+)$/i, (bot, msg, match) => AdminHandlers.removeUserHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/forward(@.+?)? (.*)$/i, (bot, msg, match) => AdminHandlers.forwardHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/((get)?logs?)(@.+?)?$/i, AdminHandlers.getLogHandler);
    bot.onTextExt(/^\/((get)?history)(@.+?)?$/i, AdminHandlers.getHistoryHandler);

    // Memes
    bot.onTextExt(/^\/randomdog(@.+?)?$/i, MemeHandlers.randomDogHandler);
    bot.onTextExt(/^\/randomcat(@.+?)?$/i, MemeHandlers.randomCatHandler);
    bot.onTextExt(/^\/randomcock(@.+?)?$/i, MemeHandlers.randomRoosterHandler);
    bot.onTextExt(/^\/(randomcab|givemecab|iwantcab|ineedcab|iwanttoseecab)(@.+?)?$/i, MemeHandlers.randomCabHandler);

    // Chat control
    bot.onTextExt(/^\/clear(@.+?)?(?: (\d*))?$/i, (bot, msg, match) => ServiceHandlers.clearHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/combine(@.+?)?(?: (\d*))?$/i, (bot, msg, match) => ServiceHandlers.combineHandler(bot, msg, match[2]));
    bot.onTextExt(/^\/(((enable)?residentmenu)|erm)(@.+?)?$/i, ServiceHandlers.residentMenuHandler);
    bot.onTextExt(/^\/(chatid)(@.+?)?$/i, ServiceHandlers.chatidHandler);

    // Callbacks and events
    bot.onExt("callback_query", ServiceHandlers.callbackHandler);
    bot.onExt("new_chat_members", ServiceHandlers.newMemberHandler);

    // Errors
    bot.on("error", error => {
        logger.error(error);
    });
}

module.exports = { setRoutes };
