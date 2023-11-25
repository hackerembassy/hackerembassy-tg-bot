/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import logger from "../../services/logger";
import { OptionalParam } from "../../utils/text";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import AdminHandlers from "../handlers/admin";
import BasicHandlers from "../handlers/basic";
import BirthdayHandlers from "../handlers/birthday";
import EmbassyHandlers from "../handlers/embassy";
import FundsHandlers from "../handlers/funds";
import MemeHandlers from "../handlers/meme";
import NeedsHandlers from "../handlers/needs";
import ServiceHandlers from "../handlers/service";
import StatusHandlers from "../handlers/status";

export function addRoutes(bot: HackerEmbassyBot): void {
    // Info
    bot.addRoute(["help"], BasicHandlers.helpHandler);
    bot.addRoute(["about"], BasicHandlers.aboutHandler);
    bot.addRoute(["join"], BasicHandlers.joinHandler);
    bot.addRoute(["events"], BasicHandlers.eventsHandler);
    bot.addRoute(["donate"], BasicHandlers.donateHandler);
    bot.addRoute(["location", "where"], BasicHandlers.locationHandler);
    bot.addRoute(["donatecash", "donatecard"], BasicHandlers.donateCardHandler);

    bot.addRoute(["donatecrypto"], BasicHandlers.donateCoinHandler, /(btc|eth|usdc|usdt)/, match => [match[1]]);

    bot.addRoute(["getresidents", "gr"], BasicHandlers.getResidentsHandler);
    bot.addRoute(["upcomingevents", "ue", "upcoming", "upcumingevents", "upcuming"], BasicHandlers.upcomingEventsHandler);
    bot.addRoute(["todayevents", "today", "te"], BasicHandlers.todayEventsHandler);

    // Panels
    bot.addRoute(["start", "startpanel", "sp"], BasicHandlers.startPanelHandler);
    bot.addRoute(["infopanel", "ip"], BasicHandlers.infoPanelHandler);
    bot.addRoute(["controlpanel", "cp"], BasicHandlers.controlPanelHandler, null, null, ["member"]);
    bot.addRoute(["memepanel", "meme", "memes", "mp"], BasicHandlers.memePanelHandler, null, null, ["member", "trusted"]);

    // Issues
    bot.addRoute(["issue"], BasicHandlers.issueHandler, OptionalParam(/(.*)/), match => [match[1]]);

    // Status
    bot.addRoute(["status", "s"], StatusHandlers.statusHandler, OptionalParam(/(short)/), match => [match[1] === "short"]);
    bot.addRoute(["shortstatus", "statusshort", "shs"], StatusHandlers.statusHandler, null, () => [true]);
    bot.addRoute(["in", "iaminside"], StatusHandlers.inHandler);
    bot.addRoute(["open", "o"], StatusHandlers.openHandler, null, null, ["member"]);
    bot.addRoute(["close", "c"], StatusHandlers.closeHandler, null, null, ["member"]);
    bot.addRoute(["inforce", "goin"], StatusHandlers.inForceHandler, /(\S+)/, match => [match[1]], ["member", "trusted"]);
    bot.addRoute(["outforce", "gohome"], StatusHandlers.outForceHandler, /(\S+)/, match => [match[1]], ["member", "trusted"]);
    bot.addRoute(["out", "iamleaving"], StatusHandlers.outHandler);
    bot.addRoute(["evict", "outforceall"], StatusHandlers.evictHandler, null, null, ["member"]);
    bot.addRoute(["going", "coming", "cuming", "g"], StatusHandlers.goingHandler, OptionalParam(/(.*)/), match => [match[1]]);
    bot.addRoute(["notgoing", "notcoming", "notcuming", "ng"], StatusHandlers.notGoingHandler);
    bot.addRoute(["autoinside"], StatusHandlers.autoinsideHandler, OptionalParam(/(.*\S)/), match => [match[1]]);
    bot.addRoute(["setmac"], StatusHandlers.setmacHandler, OptionalParam(/(?:(.*\S))/), match => [match[1]]);
    bot.addRoute(["superstatus", "ss"], ServiceHandlers.superstatusHandler, null, null, ["member"]);
    bot.addRoute(["knock", "knockknock", "tuktuk", "tuk"], EmbassyHandlers.knockHandler);

    // Stats
    bot.addRoute(["me"], StatusHandlers.profileHandler);
    bot.addRoute(["profile"], StatusHandlers.profileHandler, /(\S+)/, match => [match[1]], ["accountant"]);
    bot.addRoute(["mystats"], StatusHandlers.statsOfHandler);
    bot.addRoute(["statsof"], StatusHandlers.statsOfHandler, /(\S+)/, match => [match[1]]);
    bot.addRoute(["stats"], StatusHandlers.statsHandler, OptionalParam(/(?:from (\S+))?(?: to (\S+))?/), match => [
        match[1],
        match[2],
    ]);
    bot.addRoute(["month", "statsmonth", "monthstats"], StatusHandlers.statsMonthHandler);
    bot.addRoute(["lastmonth", "statslastmonth", "lastmonthstats"], StatusHandlers.statsMonthHandler, null, () => [
        new Date().getMonth() - 1,
    ]);

    // Emoji
    bot.addRoute(["setemoji", "emoji", "myemoji"], StatusHandlers.setemojiHandler, OptionalParam(/(.*)/), match => [match[1]], [
        "member",
        "trusted",
    ]);

    // Cams
    bot.addRoute(["webcam", "webcum", "cam", "cum", "firstfloor", "ff"], EmbassyHandlers.webcamHandler, null, null, ["member"]);
    bot.addRoute(["webcam2", "webcum2", "cam2", "cum2", "secondfloor", "sf"], EmbassyHandlers.webcam2Handler, null, null, [
        "member",
    ]);
    bot.addRoute(["doorcam", "doorcum", "precam", "precum", "dc"], EmbassyHandlers.doorcamHandler, null, null, ["member"]);
    bot.addRoute(["allcams", "cams", "allcums", "cums", "allc"], EmbassyHandlers.allCamsHandler, null, null, ["member"]);

    // Sensors
    bot.addRoute(["climate", "temp"], EmbassyHandlers.climateHandler);

    // Devices
    bot.addRoute(
        ["gayming", "gaming"],
        EmbassyHandlers.deviceHandler,
        OptionalParam(/(status|help|up|down)/),
        match => ["gaming", match[1]],
        ["member"]
    );

    // Network utils
    bot.addRoute(["isalive", "alive", "probe"], EmbassyHandlers.pingHandler, /(\S+)/, match => [match[1]], ["member"]);
    bot.addRoute(["ping"], EmbassyHandlers.pingHandler, /(\S+)/, match => [match[1], true], ["member"]);

    // Neural
    bot.addRoute(
        ["txt2img", "sd", "generateimage"],
        EmbassyHandlers.stableDiffusiondHandler,
        OptionalParam(/(.*)/ims),
        match => [match[1]],
        ["member", "trusted"]
    );
    bot.addRoute(["ask", "gpt"], ServiceHandlers.askHandler, OptionalParam(/(.*)/ims), match => [match[1]], [
        "member",
        "trusted",
    ]);

    // Printers
    bot.addRoute(["printers"], EmbassyHandlers.printersHandler);
    bot.addRoute(["anette", "anettestatus"], EmbassyHandlers.printerStatusHandler, null, () => ["anette"]);
    bot.addRoute(["plumbus", "plumbusstatus"], EmbassyHandlers.printerStatusHandler, null, () => ["plumbus"]);
    bot.addRoute(["printerstatus"], EmbassyHandlers.printerStatusHandler, /(.*\S)/, match => [match[1]]);

    // Door
    bot.addRoute(["unlock", "u"], EmbassyHandlers.unlockHandler, null, null, ["member"]);
    bot.addRoute(["doorbell", "db"], EmbassyHandlers.doorbellHandler, null, null, ["member"]);

    // Conditioner
    bot.addRoute(
        ["conditioner", "conditionerstate", "midea", "ac", "acstate", "mideastate"],
        EmbassyHandlers.conditionerHandler,
        null,
        null,
        ["member", "trusted"]
    );
    bot.addRoute(["turnconditioner"], EmbassyHandlers.turnConditionerHandler, /(on|off)/, match => [match[1] === "on"], [
        "member",
        "trusted",
    ]);
    bot.addRoute(
        ["turnonconditioner", "conditioneron", "mideaon", "acon"],
        EmbassyHandlers.turnConditionerHandler,
        null,

        () => [true],
        ["member", "trusted"]
    );
    bot.addRoute(
        ["turnoffconditioner", "conditioneroff", "mideaoff", "acoff"],
        EmbassyHandlers.turnConditionerHandler,
        null,
        () => [false],
        ["member", "trusted"]
    );
    bot.addRoute(
        ["setconditionermode", "conditionermode", "mideamode", "acmode"],
        EmbassyHandlers.setConditionerModeHandler,
        /(\S+)/,
        match => [match[1]],
        ["member", "trusted"]
    );
    bot.addRoute(
        ["setconditionertemp", "setconditionertemperature", "conditionertemp", "mideatemp", "actemp"],
        EmbassyHandlers.setConditionerTempHandler,
        /(\d*)/,
        match => [Number(match[1])],
        ["member", "trusted"]
    );
    bot.addRoute(
        ["addconditionertemp", "addconditionertemperature", "addmideatemp", "addactemp"],
        EmbassyHandlers.addConditionerTempHandler,
        /(\d*)/,
        match => [Number(match[1])],
        ["member", "trusted"]
    );

    // Sounds
    bot.addRoute(["sayinspace", "say"], EmbassyHandlers.sayinspaceHandler, /(.*)/ims, match => [match[1]]);
    bot.addRoute(["announce"], EmbassyHandlers.announceHandler, /(.*)/ims, match => [match[1]]);
    bot.addRoute(["playinspace", "play"], EmbassyHandlers.playinspaceHandler, /(.*)/ims, match => [match[1]]);
    bot.addRoute(["fartinspace", "fart"], EmbassyHandlers.playinspaceHandler, null, () => ["fart"]);
    bot.addRoute(["moaninspace", "moan"], EmbassyHandlers.playinspaceHandler, null, () => ["moan"]);
    bot.addRoute(["rickroll", "nevergonnagiveyouup"], EmbassyHandlers.playinspaceHandler, null, () => ["rickroll"]);
    bot.addRoute(["rzd"], EmbassyHandlers.playinspaceHandler, null, () => ["rzd"]);
    bot.addRoute(["adler"], EmbassyHandlers.playinspaceHandler, null, () => ["adler"]);
    bot.addRoute(["rfoxed", "rf0x1d"], EmbassyHandlers.playinspaceHandler, null, () => ["rfoxed"]);
    bot.addRoute(["nani", "omaewamoushindeiru"], EmbassyHandlers.playinspaceHandler, null, () => ["nani"]);
    bot.addRoute(["zhuchok", "zhenya", "anya", "zhanya"], EmbassyHandlers.playinspaceHandler, null, () => ["zhuchok"]);
    bot.addRoute(["badum", "badumtss"], EmbassyHandlers.playinspaceHandler, null, () => ["badumtss"]);
    bot.addRoute(["sad", "sadtrombone"], EmbassyHandlers.playinspaceHandler, null, () => ["sad"]);
    bot.addRoute(["dushno", "openwindow"], EmbassyHandlers.playinspaceHandler, null, () => ["dushno"]);

    // Funds
    bot.addRoute(["funds", "fs"], FundsHandlers.fundsHandler);
    bot.addRoute(["fund", "f"], FundsHandlers.fundHandler, /(.*\S)/, match => [match[1]]);
    bot.addRoute(["fundsall", "fundshistory", "fsa"], FundsHandlers.fundsallHandler);
    bot.addRoute(
        ["addfund"],
        FundsHandlers.addFundHandler,
        /(.*\S) with target (\d+(?:k|тыс|тысяч|т)?)\s?(\D*)/,
        match => [match[1], match[2], match[3]],
        ["accountant"]
    );
    bot.addRoute(
        ["updatefund"],
        FundsHandlers.updateFundHandler,
        /(.*\S) with target (\d+(?:k|тыс|тысяч|т)?)\s?(\D*?)(?: as (.*\S))?/,
        match => [match[1], match[2], match[3], match[4]],
        ["accountant"]
    );
    bot.addRoute(["removefund"], FundsHandlers.removeFundHandler, /(.*\S)/, match => [match[1]], ["accountant"]);
    bot.addRoute(["exportfund", "csv", "ef"], FundsHandlers.exportCSVHandler, /(.*\S)/, match => [match[1]]);
    bot.addRoute(["exportdonut", "donut", "ed"], FundsHandlers.exportDonutHandler, /(.*\S)/, match => [match[1]]);
    bot.addRoute(["closefund"], FundsHandlers.closeFundHandler, /(.*\S)/, match => [match[1]], ["accountant"]);
    bot.addRoute(
        ["changefundstatus"],
        FundsHandlers.changeFundStatusHandler,
        /of (.*\S) to (.*\S)/,
        match => [match[1], match[2]],
        ["accountant"]
    );
    bot.addRoute(["showcostsdonut", "costsdonut"], FundsHandlers.showCostsDonutHandler);
    bot.addRoute(
        ["residentscosts", "residentsdonated", "residentcosts", "rcosts"],
        FundsHandlers.residentsDonatedHandler,
        null,
        null,
        ["member", "accountant"]
    );
    bot.addRoute(["showcosts", "scosts", "scs"], FundsHandlers.showCostsHandler);

    // Donations
    bot.addRoute(
        ["costs", "cs", "rent"],
        FundsHandlers.costsHandler,
        /(\d+(?:k|тыс|тысяч|т)?)\s?(\D*?) from (\S+?)(\s.*)?/,
        match => [match[1], match[2], match[3]],
        ["accountant"]
    );
    bot.addRoute(
        ["adddonation", "ad"],
        FundsHandlers.addDonationHandler,
        /(\d+(?:k|тыс|тысяч|т)?)\s?(\D*?) from (\S+?) to (.*\S)/,
        match => [match[1], match[2], match[3], match[4]],
        ["accountant"]
    );
    bot.addRoute(["removedonation"], FundsHandlers.removeDonationHandler, /(\d+)/, match => [match[1]], ["accountant"]);
    bot.addRoute(
        ["transferdonation", "td"],
        FundsHandlers.transferDonationHandler,
        /(\d+) to (.*\S)/,
        match => [match[1], match[2]],
        ["accountant"]
    );
    bot.addRoute(
        ["tocab", "givecab", "tc"],
        FundsHandlers.transferDonationHandler,
        /(\d+)/,
        match => [match[1], "CabiaRangris"],
        ["accountant"]
    );
    bot.addRoute(
        ["tocaball", "givecaball", "givecaballmymoney", "tca"],
        FundsHandlers.transferAllToHandler,
        OptionalParam(/(.*)/),
        match => ["CabiaRangris", match[1]],
        ["accountant"]
    );
    bot.addRoute(
        ["changedonation"],
        FundsHandlers.changeDonationHandler,
        /(\d+) to (\S+)\s?(\D*?)/,
        match => [match[1], match[2], match[3]],
        ["accountant"]
    );
    bot.addRoute(["debt", "mymoney"], FundsHandlers.debtHandler, OptionalParam(/(\S+)/), match => [match[1]], ["accountant"]);

    // Needs
    bot.addRoute(["needs"], NeedsHandlers.needsHandler);
    bot.addRoute(["buy", "need"], NeedsHandlers.buyHandler, /(.*)/, match => [match[1]]);
    bot.addRoute(["bought"], NeedsHandlers.boughtHandler, /(.*)/, match => [match[1]]);
    bot.addRoute(["boughtbutton"], NeedsHandlers.boughtButtonHandler, null, match => [match[1]]); // button
    bot.addRoute(["boughtundo"], NeedsHandlers.boughtUndoHandler, /(\d+)/, match => [match[1]]); // button

    // Birthdays
    bot.addRoute(["birthdays", "birthday"], BirthdayHandlers.birthdayHandler);
    bot.addRoute(["forcebirthdaywishes", "fbw"], BirthdayHandlers.forceBirthdayWishHandler, null, null, ["admin"]);
    bot.addRoute(["mybirthday", "mybday", "bday"], BirthdayHandlers.myBirthdayHandler, OptionalParam(/(.*\S)/), match => [
        match[1],
    ]);

    // Admin
    bot.addRoute(["getusers", "users", "gu"], AdminHandlers.getUsersHandler, null, null, ["admin"]);
    bot.addRoute(["getrestrictedusers", "restricted"], AdminHandlers.getRestrictedUsersHandler, null, null, ["admin"]);
    bot.addRoute(["adduser"], AdminHandlers.addUserHandler, /(\S+?) as (\S+)/, match => [match[1], match[2]], ["admin"]);
    bot.addRoute(["updateroles"], AdminHandlers.updateRolesHandler, /of (\S+?) to (\S+)/, match => [match[1], match[2]], [
        "admin",
    ]);
    bot.addRoute(["restrict"], AdminHandlers.updateRolesHandler, /(\S+?)/, match => [match[1], "restricted"], ["admin"]);
    bot.addRoute(["restrictbyid"], AdminHandlers.updateRolesByIdHandler, /(\d+?)/, match => [match[1], "restricted"], ["admin"]);
    bot.addRoute(["unblock"], AdminHandlers.updateRolesHandler, /(\S+?)/, match => [match[1], "default"], ["admin"]);
    bot.addRoute(["unblockbyid"], AdminHandlers.updateRolesByIdHandler, /(\d+?)/, match => [match[1], "default"], ["admin"]);
    bot.addRoute(["removeuser"], AdminHandlers.removeUserHandler, /(\S+)/, match => [match[1]], ["admin"]);
    bot.addRoute(["removeuserbyid"], AdminHandlers.removeUserByIdHandler, /(\d+)/, match => [match[1]], ["admin"]);
    bot.addRoute(["forward"], AdminHandlers.forwardHandler, /(.*)/, match => [match[1]], ["admin"]);
    bot.addRoute(["getlogs", "logs", "log"], AdminHandlers.getLogHandler, null, null, ["admin"]);
    bot.addRoute(["getstate", "state"], AdminHandlers.getStateHandler, null, null, ["admin"]);
    bot.addRoute(["cleanstate", "clearstate"], AdminHandlers.cleanStateHandler, null, null, ["admin"]);
    bot.addRoute(["stoplive", "cleanlive"], AdminHandlers.stopLiveHandler, OptionalParam(/(\S+)/), match => [match[1]], [
        "admin",
    ]);

    // Memes
    bot.addRoute(["randomdog", "dog"], MemeHandlers.randomDogHandler);
    bot.addRoute(["randomcat", "cat"], MemeHandlers.randomCatHandler);
    bot.addRoute(["randomcock", "cock"], MemeHandlers.randomRoosterHandler);
    bot.addRoute(["randomcab", "cab", "givemecab", "iwantcab", "ineedcab", "iwanttoseecab"], MemeHandlers.randomCabHandler);
    bot.addRoute(["syrniki", "pidarasi", "pidorasi"], MemeHandlers.imageHandler, null, () => [
        "./resources/images/memes/syrniki.jpeg",
    ]);

    // Chat control
    bot.addRoute(["clear"], ServiceHandlers.clearHandler, OptionalParam(/(\d*)/), match => [match[1]], ["member"]);
    bot.addRoute(["combine", "squash", "sq"], ServiceHandlers.combineHandler, OptionalParam(/(\d*)/), match => [match[1]], [
        "member",
    ]);
    bot.addRoute(["enableresidentmenu", "residentmenu"], ServiceHandlers.residentMenuHandler, null, null, ["member"]);
    bot.addRoute(["chatid"], ServiceHandlers.chatidHandler, null, null, ["admin"]);
    bot.addRoute(["removebuttons"], ServiceHandlers.removeButtons, null, null, ["member"]);
}

export function startRouting(bot: HackerEmbassyBot, debug: boolean = false) {
    // Routing messages
    bot.on("message", message => bot.routeMessage(message));

    // Callbacks and events
    bot.onExt("callback_query", ServiceHandlers.callbackHandler);
    bot.onExt("chat_member", ServiceHandlers.newMemberHandler);

    // Debug logging
    if (debug) {
        logger.debug("[debug] routes are added");

        bot.on("chat_member", member => {
            logger.debug(`chat_member: ${JSON.stringify(member)}`);
        });

        bot.on("message", (message, metadata) => {
            logger.debug(`message: ${JSON.stringify(message)};\nmetadata: ${JSON.stringify(metadata)}`);
        });
    }

    // Errors
    bot.on("error", error => {
        logger.error(error);
    });
}
