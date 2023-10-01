/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import logger from "../services/logger";
import HackerEmbassyBot from "./HackerEmbassyBot";
import AdminHandlers from "./handlers/admin";
import BasicHandlers from "./handlers/basic";
import BirthdayHandlers from "./handlers/birthday";
import EmbassyHandlers from "./handlers/embassy";
import FundsHandlers from "./handlers/funds";
import MemeHandlers from "./handlers/meme";
import NeedsHandlers from "./handlers/needs";
import ServiceHandlers from "./handlers/service";
import StatusHandlers from "./handlers/status";

class RegexCommander {
    botname: string;

    constructor(botname: string = "") {
        this.botname = botname;
    }

    command(aliases: string[], params: RegExp | undefined = undefined, optional: boolean = true, flags: string = "i"): RegExp {
        const commandPart = `/(?:${aliases.join("|")})(?:@${this.botname})?`;
        const paramsPart = params ? (optional ? `(?: ${params.source})?` : ` ${params.source}`) : "";
        return new RegExp(`^${commandPart}${paramsPart}$`, flags);
    }
}

export function setRoutes(bot: HackerEmbassyBot): void {
    const rc = new RegexCommander(bot.Name);

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
    bot.onTextExt(rc.command(["upcomingevents", "ue", "upcoming", "upcumingevents", "upcuming"]), BasicHandlers.getEventsHandler);

    // Panels
    bot.onTextExt(rc.command(["start", "startpanel", "sp"]), BasicHandlers.startPanelHandler);
    bot.onTextExt(rc.command(["infopanel", "ip"]), BasicHandlers.infoPanelHandler);
    bot.onTextExt(rc.command(["controlpanel", "cp"]), BasicHandlers.controlPanelHandler, ["member"]);

    // Issues
    bot.onTextExt(rc.command(["issue"], /(.*)/), (bot, msg, match) => BasicHandlers.issueHandler(bot, msg, match[1]));

    // Status
    bot.onTextExt(rc.command(["status", "s"]), (bot, msg) => StatusHandlers.statusHandler(bot, msg));
    bot.onTextExt(rc.command(["in", "iaminside"]), StatusHandlers.inHandler);
    bot.onTextExt(rc.command(["open", "o"]), StatusHandlers.openHandler, ["member"]);
    bot.onTextExt(rc.command(["close", "c"]), StatusHandlers.closeHandler, ["member"]);
    bot.onTextExt(
        rc.command(["inforce", "goin"], /(\S+)/, false),
        (bot, msg, match) => StatusHandlers.inForceHandler(bot, msg, match[1]),
        ["member"]
    );
    bot.onTextExt(
        rc.command(["outforce", "gohome"], /(\S+)/, false),
        (bot, msg, match) => StatusHandlers.outForceHandler(bot, msg, match[1]),
        ["member"]
    );
    bot.onTextExt(rc.command(["out", "iamleaving"]), StatusHandlers.outHandler);
    bot.onTextExt(rc.command(["evict", "outforceall"]), StatusHandlers.evictHandler, ["member"]);
    bot.onTextExt(rc.command(["going", "coming", "cuming", "g"], /(.*)/), (bot, msg, match) =>
        StatusHandlers.goingHandler(bot, msg, match[1])
    );
    bot.onTextExt(rc.command(["notgoing", "notcoming", "notcuming", "ng"]), StatusHandlers.notGoingHandler);
    bot.onTextExt(rc.command(["autoinside"], /(.*\S)/), (bot, msg, match) =>
        StatusHandlers.autoinsideHandler(bot, msg, match[1])
    );
    bot.onTextExt(rc.command(["setmac"], /(?:(.*\S))/), (bot, msg, match) => StatusHandlers.setmacHandler(bot, msg, match[1]));
    bot.onTextExt(rc.command(["superstatus", "ss"]), ServiceHandlers.superstatusHandler, ["member"]);

    // Stats
    bot.onTextExt(rc.command(["mystats"]), (bot, msg) => StatusHandlers.statsOfHandler(bot, msg));
    bot.onTextExt(rc.command(["statsof"], /(\S+)/, false), (bot, msg, match) =>
        StatusHandlers.statsOfHandler(bot, msg, match[3])
    );
    bot.onTextExt(rc.command(["stats"], /(?:from (\S+))?(?: to (\S+))?/), (bot, msg, match) =>
        StatusHandlers.statsHandler(bot, msg, match[1], match[2])
    );
    bot.onTextExt(rc.command(["month", "statsmonth", "monthstats"]), (bot, msg) => StatusHandlers.statsMonthHandler(bot, msg));
    bot.onTextExt(rc.command(["lastmonth", "statslastmonth", "lastmonthstats"]), (bot, msg) =>
        StatusHandlers.statsMonthHandler(bot, msg, new Date().getMonth() - 1)
    );

    // Emoji
    bot.onTextExt(
        rc.command(["setemoji", "emoji", "myemoji"], /(.*)/),
        (bot, msg, match) => StatusHandlers.setemojiHandler(bot, msg, match[1]),
        ["member"]
    );

    // Cams
    bot.onTextExt(rc.command(["webcam", "webcum", "cam", "cum", "firstfloor", "ff"]), EmbassyHandlers.webcamHandler, ["member"]);
    bot.onTextExt(rc.command(["webcam2", "webcum2", "cam2", "cum2", "secondfloor", "sf"]), EmbassyHandlers.webcam2Handler, [
        "member",
    ]);
    bot.onTextExt(rc.command(["doorcam", "doorcum", "dc"]), EmbassyHandlers.doorcamHandler, ["member"]);
    bot.onTextExt(rc.command(["allcams", "cams", "allcums", "cums", "allc"]), EmbassyHandlers.allCamsHandler, ["member"]);

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
    bot.onTextExt(rc.command(["unlock", "u"]), EmbassyHandlers.unlockHandler, ["member"]);
    bot.onTextExt(rc.command(["doorbell", "db"]), EmbassyHandlers.doorbellHandler, ["member"]);

    // Conditioner
    bot.onTextExt(
        rc.command(["conditioner", "conditionerstate", "midea", "ac", "acstate", "mideastate"]),
        (bot, msg) => EmbassyHandlers.conditionerHandler(bot, msg),
        ["member"]
    );
    bot.onTextExt(
        rc.command(["turnonconditioner", "conditioneron", "mideaon", "acon"]),
        (bot, msg) => EmbassyHandlers.turnConditionerHandler(bot, msg, true),
        ["member"]
    );
    bot.onTextExt(
        rc.command(["turnoffconditioner", "conditioneroff", "mideaoff", "acoff"]),
        (bot, msg) => EmbassyHandlers.turnConditionerHandler(bot, msg, false),
        ["member"]
    );
    bot.onTextExt(
        rc.command(["setConditionerMode", "conditionermode", "mideamode", "acmode"], /(\S+)/, false),
        (bot, msg, match) => EmbassyHandlers.setConditionerModeHandler(bot, msg, match[1]),
        ["member"]
    );
    bot.onTextExt(
        rc.command(["setConditionerTemp", "setConditionerTemperature", "conditionertemp", "mideatemp", "actemp"], /(\d*)/, false),
        (bot, msg, match) => EmbassyHandlers.setConditionerTempHandler(bot, msg, Number(match[1])),
        ["member"]
    );

    // Monitoring
    bot.onTextExt(rc.command(["monitor"]), (bot, msg) => EmbassyHandlers.monitorHandler(bot, msg, false));

    // Sounds
    bot.onTextExt(rc.command(["sayinspace", "say"], /(.*)/, true, "ims"), (bot, msg, match) =>
        EmbassyHandlers.sayinspaceHandler(bot, msg, match[1])
    );
    bot.onTextExt(rc.command(["rzd", "announce"], /(.*)/, false, "ims"), (bot, msg, match) =>
        EmbassyHandlers.announceHandler(bot, msg, match[1])
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
    bot.onTextExt(rc.command(["rzd"]), (bot, msg) =>
        EmbassyHandlers.playinspaceHandler(bot, msg, "http://le-fail.lan:8001/rzd.mp3")
    );
    bot.onTextExt(rc.command(["adler"]), (bot, msg) =>
        EmbassyHandlers.playinspaceHandler(bot, msg, "http://le-fail.lan:8001/adler.mp3")
    );
    bot.onTextExt(rc.command(["rfoxed", "rf0x1d"]), (bot, msg) =>
        EmbassyHandlers.playinspaceHandler(bot, msg, "http://le-fail.lan:8001/rfoxed.mp3")
    );
    bot.onTextExt(rc.command(["nani", "omaewamoushindeiru"]), (bot, msg) =>
        EmbassyHandlers.playinspaceHandler(bot, msg, "http://le-fail.lan:8001/nani.mp3")
    );

    // Funds
    bot.onTextExt(rc.command(["funds"]), FundsHandlers.fundsHandler);
    bot.onTextExt(rc.command(["fund"], /(.*\S)/, false), (bot, msg, match) => FundsHandlers.fundHandler(bot, msg, match[1]));
    bot.onTextExt(rc.command(["fundsall", "fundshistory"]), FundsHandlers.fundsallHandler);
    bot.onTextExt(
        rc.command(["addfund"], /(.*\S) with target (\d+(?:k|тыс|тысяч|т)?)\s?(\D*)/, false),
        (bot, msg, match) => FundsHandlers.addFundHandler(bot, msg, match[1], match[2], match[3]),
        ["accountant"]
    );
    bot.onTextExt(
        rc.command(["updatefund"], /(.*\S) with target (\d+(?:k|тыс|тысяч|т)?)\s?(\D*?)(?: as (.*\S))?/, false),
        (bot, msg, match) => FundsHandlers.updateFundHandler(bot, msg, match[1], match[2], match[3], match[4]),
        ["accountant"]
    );
    bot.onTextExt(
        rc.command(["removefund"], /(.*\S)/, false),
        (bot, msg, match) => FundsHandlers.removeFundHandler(bot, msg, match[1]),
        ["accountant"]
    );
    bot.onTextExt(rc.command(["exportfund"], /(.*\S)/, false), (bot, msg, match) =>
        FundsHandlers.exportCSVHandler(bot, msg, match[1])
    );
    bot.onTextExt(rc.command(["exportdonut"], /(.*\S)/, false), (bot, msg, match) =>
        FundsHandlers.exportDonutHandler(bot, msg, match[1])
    );
    bot.onTextExt(
        rc.command(["closefund"], /(.*\S)/, false),
        (bot, msg, match) => FundsHandlers.closeFundHandler(bot, msg, match[1]),
        ["accountant"]
    );
    bot.onTextExt(
        rc.command(["changefundstatus"], /of (.*\S) to (.*\S)/, false),
        (bot, msg, match) => FundsHandlers.changeFundStatusHandler(bot, msg, match[1], match[2]),
        ["accountant"]
    );
    bot.onTextExt(rc.command(["showcostsdonut", "costsdonut", "donut"]), (bot, msg) =>
        FundsHandlers.showCostsDonutHandler(bot, msg)
    );
    bot.onTextExt(
        rc.command(["residentscosts", "residentsdonated", "residentcosts"]),
        (bot, msg) => FundsHandlers.residentsDonatedHandler(bot, msg),
        ["member", "accountant"]
    );
    bot.onTextExt(rc.command(["costs", "showcosts"]), (bot, msg) => FundsHandlers.showCostsHandler(bot, msg));

    // Donations
    bot.onTextExt(
        rc.command(["costs"], /(\d+(?:k|тыс|тысяч|т)?)\s?(\D*?) from (\S+?)(\s.*)?/, false),
        (bot, msg, match) => FundsHandlers.costsHandler(bot, msg, match[1], match[2], match[3]),
        ["accountant"]
    );
    bot.onTextExt(
        rc.command(["adddonation"], /(\d+(?:k|тыс|тысяч|т)?)\s?(\D*?) from (\S+?) to (.*\S)/, false),
        (bot, msg, match) => FundsHandlers.addDonationHandler(bot, msg, match[1], match[2], match[3], match[4]),
        ["accountant"]
    );
    bot.onTextExt(
        rc.command(["removedonation"], /(\d+)/, false),
        (bot, msg, match) => FundsHandlers.removeDonationHandler(bot, msg, match[1]),
        ["accountant"]
    );
    bot.onTextExt(
        rc.command(["transferdonation"], /(\d+) to (.*\S)/, false),
        (bot, msg, match) => FundsHandlers.transferDonationHandler(bot, msg, match[1], match[2]),
        ["accountant"]
    );
    bot.onTextExt(
        rc.command(["changedonation"], /(\d+) to (\S+)\s?(\D*?)/, false),
        (bot, msg, match) => FundsHandlers.changeDonationHandler(bot, msg, match[1], match[2], match[3]),
        ["accountant"]
    );

    // Needs
    bot.onTextExt(rc.command(["needs"]), NeedsHandlers.needsHandler);
    bot.onTextExt(rc.command(["buy", "need"], /(.*)/, false), (bot, msg, match) => NeedsHandlers.buyHandler(bot, msg, match[1]));
    bot.onTextExt(rc.command(["bought"], /(.*)/, false), (bot, msg, match) => NeedsHandlers.boughtHandler(bot, msg, match[1]));

    // Birthdays
    bot.onTextExt(rc.command(["birthdays"]), (bot, msg) => BirthdayHandlers.birthdayHandler(bot, msg));
    bot.onTextExt(rc.command(["forcebirthdaywishes", "fbw"]), BirthdayHandlers.forceBirthdayWishHandler, ["admin"]);
    bot.onTextExt(rc.command(["mybirthday"], /(.*\S)/), (bot, msg, match) =>
        BirthdayHandlers.myBirthdayHandler(bot, msg, match[1])
    );

    // Admin
    bot.onTextExt(rc.command(["getusers", "users", "gu"]), AdminHandlers.getUsersHandler, ["admin"]);
    bot.onTextExt(
        rc.command(["adduser"], /(\S+?) as (\S+)/, false),
        (bot, msg, match) => AdminHandlers.addUserHandler(bot, msg, match[1], match[2]),
        ["admin"]
    );
    bot.onTextExt(
        rc.command(["updateroles"], /of (\S+?) to (\S+)/, false),
        (bot, msg, match) => AdminHandlers.updateRolesHandler(bot, msg, match[1], match[2]),
        ["admin"]
    );
    bot.onTextExt(
        rc.command(["removeuser"], /(\S+)/, false),
        (bot, msg, match) => AdminHandlers.removeUserHandler(bot, msg, match[1]),
        ["admin"]
    );
    bot.onTextExt(rc.command(["forward"], /(.*)/, false), (bot, msg, match) => AdminHandlers.forwardHandler(bot, msg, match[1]), [
        "admin",
    ]);
    bot.onTextExt(rc.command(["getlogs", "logs", "log"]), AdminHandlers.getLogHandler, ["admin"]);
    bot.onTextExt(rc.command(["getstate", "state"]), AdminHandlers.getStateHandler, ["admin"]);
    bot.onTextExt(rc.command(["cleanstate"]), AdminHandlers.cleanStateHandler, ["admin"]);
    bot.onTextExt(
        rc.command(["stoplive", "cleanlive"], /(\S+)/),
        (bot, msg, match) => AdminHandlers.stopLiveHandler(bot, msg, match[1]),
        ["admin"]
    );

    // Memes
    bot.onTextExt(rc.command(["randomdog", "dog"]), MemeHandlers.randomDogHandler);
    bot.onTextExt(rc.command(["randomcat", "cat"]), MemeHandlers.randomCatHandler);
    bot.onTextExt(rc.command(["randomcock", "cock"]), MemeHandlers.randomRoosterHandler);
    bot.onTextExt(
        rc.command(["randomcab", "cab", "givemecab", "iwantcab", "ineedcab", "iwanttoseecab"]),
        MemeHandlers.randomCabHandler
    );

    // Chat control
    bot.onTextExt(rc.command(["clear"], /(\d*)/, true), (bot, msg, match) => ServiceHandlers.clearHandler(bot, msg, match[1]), [
        "member",
    ]);
    bot.onTextExt(
        rc.command(["combine"], /(\d*)/, true),
        (bot, msg, match) => ServiceHandlers.combineHandler(bot, msg, match[1]),
        ["member"]
    );
    bot.onTextExt(rc.command(["enableresidentmenu", "residentmenu"]), ServiceHandlers.residentMenuHandler, ["member"]);
    bot.onTextExt(rc.command(["chatid"]), ServiceHandlers.chatidHandler, ["admin"]);

    // Callbacks and events
    bot.onExt("callback_query", ServiceHandlers.callbackHandler);
    bot.onExt("new_chat_members", ServiceHandlers.newMemberHandler);

    // Errors
    bot.on("error", error => {
        logger.error(error);
    });
}
