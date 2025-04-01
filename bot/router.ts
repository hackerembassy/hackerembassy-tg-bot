/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import config from "config";

import { UserRole } from "@data/types";
import broadcast, { BroadcastEvents } from "@services/common/broadcast";
import { AvailableModels } from "@services/external/neural";
import logger from "@services/common/logger";
import { DURATION_STRING_REGEX } from "@utils/date";
import { BotConfig } from "@config";

import HackerEmbassyBot from "./core/HackerEmbassyBot";
import AdminHandlers from "./handlers/admin";
import BasicHandlers from "./handlers/basic";
import BirthdayHandlers from "./handlers/birthday";
import EmbassyHandlers from "./handlers/embassy";
import FundsHandlers from "./handlers/funds";
import MemeHandlers from "./handlers/meme";
import NeedsHandlers from "./handlers/needs";
import ServiceHandlers from "./handlers/service";
import StatusHandlers from "./handlers/status";
import TopicsHandlers from "./handlers/subscriptions";
import { OptionalParam } from "./core/helpers";

const botConfig = config.get<BotConfig>("bot");

// Typical role sets
const TrustedMembers = ["member", "trusted"] as UserRole[];
const Members = ["member"] as UserRole[];
const Accountants = ["accountant"] as UserRole[];
const Admins = ["admin"] as UserRole[];

// Common regexes
const CaptureListOfIds = /(\d[\d\s,]*)/;
const CaptureInteger = /(-?\d+)/;

export function addRoutes(bot: HackerEmbassyBot): void {
    // Info
    bot.addRoute(["help"], BasicHandlers.helpHandler, OptionalParam(/(\S+)/), match => [match[1]]);
    bot.addRoute(["about"], BasicHandlers.aboutHandler);
    bot.addRoute(["join"], BasicHandlers.joinHandler);
    bot.addRoute(["events"], BasicHandlers.eventsHandler);
    bot.addRoute(["location", "where"], BasicHandlers.locationHandler);
    bot.addRoute(["getresidents", "gr", "residents", "members"], BasicHandlers.getResidentsHandler);

    // Donations
    bot.addRoute(["donate"], BasicHandlers.donateHandler);
    bot.addRoute(["donatecash", "cash", "donatecard", "card"], BasicHandlers.donateCardHandler);
    bot.addRoute(["donatecrypto", "crypto"], BasicHandlers.donateCoinHandler, /(btc|eth|usdc|usdt|trx|ton)/, match => [match[1]]);
    bot.addRoute(["btc"], BasicHandlers.donateCoinHandler, null, () => ["btc"]);
    bot.addRoute(["eth"], BasicHandlers.donateCoinHandler, null, () => ["eth"]);
    bot.addRoute(["usdc"], BasicHandlers.donateCoinHandler, null, () => ["usdc"]);
    bot.addRoute(["usdt"], BasicHandlers.donateCoinHandler, null, () => ["usdt"]);
    bot.addRoute(["trx"], BasicHandlers.donateCoinHandler, null, () => ["trx"]);
    bot.addRoute(["ton"], BasicHandlers.donateCoinHandler, null, () => ["ton"]);
    bot.addRoute(["donateequipment", "equipment"], BasicHandlers.donateEquipmentHandler);

    // Events
    if (botConfig.features.calendar) {
        bot.addRoute(
            ["upcomingevents", "ue", "upcoming", "upcumingevents", "upcuming"],
            BasicHandlers.upcomingEventsHandler,
            OptionalParam(/(\d)/),
            match => [match[1]]
        );
        bot.addRoute(["todayevents", "today", "te"], BasicHandlers.todayEventsHandler);
    }

    // Panels
    bot.addRoute(["start", "startpanel", "sp"], BasicHandlers.startPanelHandler);
    bot.addRoute(["infopanel", "info", "ip", "faq"], BasicHandlers.infoPanelHandler);
    bot.addRoute(["memepanel", "meme", "memes", "mp"], BasicHandlers.memePanelHandler, null, null, TrustedMembers);

    // Issues
    bot.addRoute(["issue", "report"], BasicHandlers.issueHandler, OptionalParam(/(.*)/ims), match => ["space", match[1]]);
    bot.addRoute(["bug", "bugreport"], BasicHandlers.issueHandler, OptionalParam(/(.*)/ims), match => ["bot", match[1]]);

    // Status
    bot.addRoute(["status", "s"], StatusHandlers.statusHandler, OptionalParam(/(short)/), match => [match[1] === "short"]);
    bot.addRoute(["shortstatus", "statusshort", "shs"], StatusHandlers.statusHandler, null, () => [true]);
    bot.addRoute(["livestatus", "live"], StatusHandlers.liveStatusShortcutHandler, null, null, Members);
    bot.addRoute(
        ["in", "iaminside"],
        StatusHandlers.inHandler,
        OptionalParam(RegExp(`(?:for )?(${DURATION_STRING_REGEX.source})`)),
        match => [false, match[1]]
    );
    bot.addRoute(
        ["inghost", "ghost"],
        StatusHandlers.inHandler,
        OptionalParam(RegExp(`(?:for )?(${DURATION_STRING_REGEX.source})`)),
        match => [true, match[1]],
        TrustedMembers
    );
    bot.addRoute(
        ["inforce", "inf", "goin"],
        StatusHandlers.inHandler,
        RegExp(`(\\S+)(?: (?:for )?(${DURATION_STRING_REGEX.source}))?`),
        match => [false, match[2], match[1]],
        TrustedMembers
    );
    bot.addRoute(["open", "o"], StatusHandlers.openHandler, null, null, Members);
    bot.addRoute(["close", "c"], StatusHandlers.closeHandler, null, null, Members);
    bot.addRoute(["outforce", "outf", "gohome"], StatusHandlers.outHandler, /(\S+)/, match => [match[1]], TrustedMembers);
    bot.addRoute(["out", "iamleaving"], StatusHandlers.outHandler);
    bot.addRoute(["evict", "outforceall"], StatusHandlers.evictHandler, null, null, Members);
    bot.addRoute(["going", "coming", "cuming", "g"], StatusHandlers.goingHandler, OptionalParam(/(.*)/), match => [match[1]]);
    bot.addRoute(["notgoing", "notcoming", "notcuming", "ng"], StatusHandlers.notGoingHandler, OptionalParam(/(.*)/), match => [
        match[1],
    ]);

    if (botConfig.features.autoinside)
        bot.addRoute(["autoinside"], StatusHandlers.autoinsideHandler, OptionalParam(/(.*\S)/), match => [match[1]]);

    bot.addRoute(["mac", "setmac", "mymac"], StatusHandlers.macHandler, OptionalParam(/(\S*)(?: (.+))?/), match => [
        match[1],
        match[2],
    ]);
    bot.addRoute(["detected"], StatusHandlers.detectedDevicesHandler, null, null, Admins);
    bot.addRoute(["superstatus", "ss"], ServiceHandlers.superstatusHandler, null, null, Members);

    // Stats
    bot.addRoute(["me"], StatusHandlers.profileHandler);
    bot.addRoute(["profile"], StatusHandlers.profileHandler, /(\S+)/, match => [match[1]], Accountants);
    bot.addRoute(["mystats"], StatusHandlers.statsOfHandler);
    bot.addRoute(["statsof"], StatusHandlers.statsOfHandler, /(\S+)/, match => [match[1]]);
    bot.addRoute(["stats"], StatusHandlers.statsHandler, OptionalParam(/(?:from (\S+) ?)?(?:to (\S+))?/), match => [
        match[1],
        match[2],
    ]);
    bot.addRoute(["statsall", "allstats"], StatusHandlers.statsHandler, null, () => [botConfig.launchDate]);
    bot.addRoute(["month", "statsmonth", "monthstats"], StatusHandlers.statsMonthHandler);
    bot.addRoute(["lastmonth", "statslastmonth", "lastmonthstats"], StatusHandlers.statsMonthHandler, null, () => [
        new Date().getMonth() - 1,
    ]);

    // Subscriptions
    bot.addRoute(["mysubscriptions", "subscriptions", "subs"], TopicsHandlers.mySubscriptionsHandler);
    bot.addRoute(["topics"], TopicsHandlers.topicsHandler, OptionalParam(/(all)/), match => [match[1]]);
    bot.addRoute(
        ["addtopic", "createtopic"],
        TopicsHandlers.addTopicHandler,
        /(\S+)(?: (.*))?/,
        match => [match[1], match[2]],
        Members
    );
    bot.addRoute(["deletetopic", "removetopic"], TopicsHandlers.deleteTopicHandler, /(\S+)/, match => [match[1]], Members);
    bot.addRoute(["subscribe", "sub"], TopicsHandlers.subscribeHandler, /(\S+)/, match => [match[1]]);
    bot.addRoute(["unsubscribe", "unsub"], TopicsHandlers.unsubscribeHandler, /(\S+)/, match => [match[1]]);
    bot.addRoute(["tagsubscribers", "tagsubs", "tag"], TopicsHandlers.tagSubscribersHandler, /(\S+)/, match => [match[1]]);
    bot.addRoute(
        ["notify", "notifysubs", "notifysubscribers"],
        TopicsHandlers.notifySubscribersHandler,
        OptionalParam(/(\S+) (.*)/s),
        match => [match[1], match[2]],
        Members
    );

    // Emoji
    bot.addRoute(
        ["setemoji", "emoji", "myemoji"],
        StatusHandlers.setemojiHandler,
        OptionalParam(/(.*)/),
        match => [match[1]],
        TrustedMembers
    );

    // Funds
    bot.addRoute(["funds", "fs"], FundsHandlers.fundsHandler);
    bot.addRoute(["fund", "f"], FundsHandlers.fundHandler, /(.*\S)/, match => [match[1]]);
    bot.addRoute(["fundsall", "fundshistory", "fsa"], FundsHandlers.fundsallHandler);
    bot.addRoute(
        ["addfund"],
        FundsHandlers.addFundHandler,
        /(.*\S) with target (\d+(?:\.\d+)?(?:k|тыс|тысяч|т)?)\s?(\D*)/,
        match => [match[1], match[2], match[3]],
        Accountants
    );
    bot.addRoute(
        ["updatefund"],
        FundsHandlers.updateFundHandler,
        /(.*\S) with target (\d+(?:\.\d+)?(?:k|тыс|тысяч|т)?)\s?(\D*?)(?: as (.*\S))?/,
        match => [match[1], match[2], match[3], match[4]],
        Accountants
    );
    bot.addRoute(["removefund"], FundsHandlers.removeFundHandler, /(.*\S)/, match => [match[1]], Accountants);
    bot.addRoute(["exportfund", "csv", "ef"], FundsHandlers.exportCSVHandler, /(.*\S)/, match => [match[1]]);
    bot.addRoute(["exportdonut", "donut", "ed"], FundsHandlers.exportDonutHandler, /(.*\S)/, match => [match[1]]);
    bot.addRoute(["closefund"], FundsHandlers.closeFundHandler, /(.*\S)/, match => [match[1]], Accountants);
    bot.addRoute(
        ["changefundstatus"],
        FundsHandlers.changeFundStatusHandler,
        /of (.*\S) to (.*\S)/,
        match => [match[1], match[2]],
        Accountants
    );
    bot.addRoute(["showcostsdonut", "costsdonut", "cdonut"], FundsHandlers.showCostsDonutHandler);
    bot.addRoute(
        ["residentscosts", "residentsdonated", "residentcosts", "rcosts"],
        FundsHandlers.residentsDonatedHandler,
        OptionalParam(/(all|paid|left)/),
        match => [match[1]],
        Members
    );
    bot.addRoute(
        ["residentscostshistory", "historycosts", "rhcosts", "rhcs"],
        FundsHandlers.resdientsHistoryHandler,
        OptionalParam(/(\d\d\d\d)/),
        match => [match[1]],
        Members
    );
    bot.addRoute(["showcosts", "scosts", "scs"], FundsHandlers.showCostsHandler);

    // Donations
    bot.addRoute(
        ["costs", "cs", "rent"],
        FundsHandlers.costsHandler,
        OptionalParam(/(\d+(?:\.\d+)?(?:k|тыс|тысяч|т)?)\s?(\D*?) from (\S+?)(\s.*)?/),
        match => [match[1], match[2], match[3]]
    );
    bot.addRoute(
        ["adddonation", "ad"],
        FundsHandlers.addDonationHandler,
        /(\d+(?:\.\d+)?(?:k|тыс|тысяч|т)?)\s?(\D*?) from (\S+?) to (.*\S)/,
        match => [match[1], match[2], match[3], match[4]],
        Accountants
    );
    bot.addRoute(["removedonation"], FundsHandlers.removeDonationHandler, /(\d+)/, match => [match[1]], Accountants);
    bot.addRoute(
        ["transferdonation", "td"],
        FundsHandlers.transferDonationHandler,
        /(\d[\d\s,]*?) to (.*\S)/,
        match => [match[1], match[2]],
        Accountants
    );

    bot.addRoute(["tosafe"], FundsHandlers.transferDonationHandler, CaptureListOfIds, match => [match[1], "safe"], Accountants);

    bot.addRoute(
        ["topaid", "paid", "tp"],
        FundsHandlers.transferDonationHandler,
        CaptureListOfIds,
        match => [match[1], "paid"],
        Accountants
    );

    bot.addRoute(
        ["tosafeall"],
        FundsHandlers.transferAllToHandler,
        OptionalParam(/(.*)/),
        match => ["safe", match[1]],
        Accountants
    );
    bot.addRoute(
        ["topaidall", "paidall"],
        FundsHandlers.transferAllToHandler,
        OptionalParam(/(.*)/),
        match => ["paid", match[1]],
        Accountants
    );
    bot.addRoute(
        ["changedonation"],
        FundsHandlers.changeDonationHandler,
        /(\d+) to (\S+)\s?(\D*?)/,
        match => [match[1], match[2], match[3]],
        Accountants
    );
    bot.addRoute(["debt", "mymoney"], FundsHandlers.debtHandler, OptionalParam(/(\S+)/), match => [match[1]], Accountants);

    bot.addRoute(["getsponsors", "sponsors"], FundsHandlers.sponsorsHandler);
    bot.addRoute(["refreshsponsors", "recalculatesponsors"], FundsHandlers.refreshSponsorshipsHandler, null, null, Accountants);

    // Needs
    bot.addRoute(["needs"], NeedsHandlers.needsHandler);
    bot.addRoute(["buy", "need"], NeedsHandlers.buyHandler, /(.*)/, match => [match[1]]);
    bot.addRoute(["bought"], NeedsHandlers.boughtHandler, /(.*)/, match => [match[1]]);
    bot.addRoute(["boughtbutton"], NeedsHandlers.boughtButtonHandler, null, match => [match[1]]); // button
    bot.addRoute(["boughtundo"], NeedsHandlers.boughtUndoHandler, /(\d+)/, match => [match[1]]); // button

    // Birthdays
    if (botConfig.features.birthday) {
        bot.addRoute(["birthdays", "birthday"], BirthdayHandlers.birthdayHandler);
        bot.addRoute(["forcebirthdaywishes", "fbw"], BirthdayHandlers.forceBirthdayWishHandler, null, null, Admins);
        bot.addRoute(["mybirthday", "mybday", "bday"], BirthdayHandlers.myBirthdayHandler, OptionalParam(/(.*\S)/), match => [
            match[1],
        ]);
    }

    // Tokens
    bot.addRoute(["token"], ServiceHandlers.tokenHandler, OptionalParam(/(\S+?)/), match => [match[1]], TrustedMembers);

    // Admin
    bot.addRoute(["getuser", "user"], AdminHandlers.getUserHandler, OptionalParam(/(\S+?)/), match => [match[1]], Admins);
    bot.addRoute(["setuser"], AdminHandlers.setUserHandler, OptionalParam(/(.*)/ims), match => [match[1]], Admins);
    bot.addRoute(["getrestrictedusers", "restricted"], AdminHandlers.getRestrictedUsersHandler, null, null, Admins);
    bot.addRoute(["updateroles"], AdminHandlers.updateRolesHandler, /of (\S+?) to (\S+)/, match => [match[1], match[2]], Admins);
    bot.addRoute(["restrict"], AdminHandlers.updateRolesHandler, /(\S+?)/, match => [match[1], "restricted"], Admins);
    bot.addRoute(["restrictbyid"], AdminHandlers.updateRolesByIdHandler, /(\d+?)/, match => [match[1], "restricted"], Admins);
    bot.addRoute(["unblock"], AdminHandlers.updateRolesHandler, /(\S+?)/, match => [match[1], "default"], Admins);
    bot.addRoute(["unblockbyid"], AdminHandlers.updateRolesByIdHandler, /(\d+?)/, match => [match[1], "default"], Admins);
    bot.addRoute(["removeuser"], AdminHandlers.removeUserHandler, /(\S+)/, match => [match[1]], Admins);
    bot.addRoute(["removeuserbyid"], AdminHandlers.removeUserByIdHandler, /(\d+)/, match => [match[1]], Admins);
    bot.addRoute(["custom", "forward"], AdminHandlers.customHandler, OptionalParam(/(.*)/ims), match => [match[1]], Admins);
    bot.addRoute(["copy"], AdminHandlers.copyMessageHandler, /(\S+?)/, match => [match[1]], Admins);
    bot.addRoute(
        ["customtest", "customt", "forwardtest", "forwardt"],
        AdminHandlers.customHandler,
        OptionalParam(/(.*)/ims),
        match => [match[1], true],
        Members
    );
    bot.addRoute(["selecttarget", "target"], AdminHandlers.selectForwardTargetHandler, null, null, Admins);
    bot.addRoute(["getlogs", "logs", "log"], AdminHandlers.getLogHandler, null, null, Admins);
    bot.addRoute(["getstate", "state"], AdminHandlers.getStateHandler, null, null, Admins);
    bot.addRoute(["cleanstate", "clearstate"], AdminHandlers.cleanStateHandler, null, null, Admins);
    bot.addRoute(["stoplive", "cleanlive"], AdminHandlers.stopLiveHandler, OptionalParam(/(\S+)/), match => [match[1]], Admins);
    bot.addRoute(
        ["setflag", "setf", "set"],
        AdminHandlers.setFlagHandler,
        /(\S+?) (true|false|1|0)/,
        match => [match[1], match[2]],
        Admins
    );
    bot.addRoute(["getflags", "getf"], AdminHandlers.getFlagsHandler, null, null, Admins);
    bot.addRoute(["linkchat"], AdminHandlers.linkChatHandler, CaptureInteger, match => [match[1]], Admins);
    bot.addRoute(["unlinkchat"], AdminHandlers.unlinkChatHandler, null, null, Admins);
    bot.addRoute(["getlinkedchat"], AdminHandlers.getLinkedChatHandler, null, null, Admins);

    // Memes
    bot.addRoute(["randomdog", "dog"], MemeHandlers.randomImagePathHandler, null, () => ["./resources/images/dogs"]);
    bot.addRoute(["randomcat", "cat"], MemeHandlers.randomImagePathHandler, null, () => ["./resources/images/cats"]);
    bot.addRoute(["randomcock", "cock"], MemeHandlers.randomImagePathHandler, null, () => ["./resources/images/roosters"]);
    bot.addRoute(["randomzhabka", "randomtoad", "zhabka", "zhaba", "toad", "wednesday"], MemeHandlers.randomZhabkaHandler);
    bot.addRoute(["syrniki", "pidarasi", "pidorasi"], MemeHandlers.imageHandler, null, () => [
        "./resources/images/memes/syrniki.jpeg",
    ]);
    bot.addRoute(["slap"], MemeHandlers.slapHandler, OptionalParam(/(\S+)/), match => [match[1]]);
    bot.addRoute(["hug"], MemeHandlers.hugHandler, OptionalParam(/(\S+)/), match => [match[1]]);

    // Chat control
    bot.addRoute(["clear"], ServiceHandlers.clearHandler, OptionalParam(/(\d*)/), match => [match[1]], Members);
    bot.addRoute(
        ["combine", "squash", "sq"],
        ServiceHandlers.combineHandler,
        OptionalParam(/(\d*)/),
        match => [match[1]],
        Members
    );
    bot.addRoute(["chatid"], ServiceHandlers.chatidHandler);
    bot.addRoute(["removebuttons", "rb", "static"], ServiceHandlers.removeButtons, null, null, Members);
    bot.addRoute(["ban", "block"], AdminHandlers.banHandler, OptionalParam(/(\S+)/), match => [match[1]], Members);
    bot.addRoute(
        ["autoremove", "silent", "stopsrach", "стопсрач"],
        AdminHandlers.autoRemoveHandler,
        OptionalParam(/(\S+)/),
        match => [match[1]],
        Admins
    );
    bot.addRoute(["knock"], ServiceHandlers.deprecatedHandler);

    // Language
    bot.addRoute(
        ["setlanguage", "setlang", "lang", "language"],
        ServiceHandlers.setLanguageHandler,
        OptionalParam(/(\S+)/),
        match => [match[1]]
    );
    bot.addRoute(["ru", "russian"], ServiceHandlers.setLanguageHandler, null, () => ["ru"]);
    bot.addRoute(["en", "english"], ServiceHandlers.setLanguageHandler, null, () => ["en"]);

    // Hacker Embassy specific commands
    if (botConfig.features.embassy) addEmbassySpecificRoutes(bot);
}

export function addEventHandlers(bot: HackerEmbassyBot) {
    broadcast.addListener(BroadcastEvents.SpaceOpened, state => {
        StatusHandlers.openedNotificationHandler(bot, state);
    });
    broadcast.addListener(BroadcastEvents.SpaceClosed, state => {
        StatusHandlers.closedNotificationHandler(bot, state);
    });
    broadcast.addListener(BroadcastEvents.SpaceUnlocked, username => {
        EmbassyHandlers.unlockedNotificationHandler(bot, username);
    });
}

export function startRouting(bot: HackerEmbassyBot, debug: boolean = false) {
    // Routing messages
    bot.on("message", message => bot.routeMessage(message));
    bot.on("voice", message => EmbassyHandlers.voiceInSpaceHandler(bot, message));
    bot.on("callback_query", bot.routeCallback);
    bot.onExt("chat_member", ServiceHandlers.newMemberHandler);

    if (botConfig.features.reactions) bot.on("message", message => bot.reactToMessage(message));

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
}

function addEmbassySpecificRoutes(bot: HackerEmbassyBot) {
    // Control
    bot.addRoute(["controlpanel", "cp"], BasicHandlers.controlPanelHandler, null, null, Members);

    // Printers
    bot.addRoute(["printers"], EmbassyHandlers.printersHandler);
    bot.addRoute(["anette", "anettestatus"], EmbassyHandlers.printerStatusHandler, null, () => ["anette"]);
    bot.addRoute(["plumbus", "plumbusstatus"], EmbassyHandlers.printerStatusHandler, null, () => ["plumbus"]);
    bot.addRoute(["printerstatus"], EmbassyHandlers.printerStatusHandler, /(.*\S)/, match => [match[1]]);

    // Door
    bot.addRoute(["unlock", "u"], EmbassyHandlers.unlockHandler, null, null, Members);
    bot.addRoute(["doorbell", "db"], EmbassyHandlers.doorbellHandler, null, null, Members);

    // Conditioner Downstairs
    bot.addRoute(
        ["conditioner", "conditioner1", "midea", "ac", "ac1"],
        EmbassyHandlers.conditionerHandler,
        null,
        () => ["downstairs"],
        TrustedMembers
    );
    bot.addRoute(
        ["mideaon", "acon", "ac1on"],
        EmbassyHandlers.turnOnConditionerHandler,
        null,
        () => ["downstairs"],
        TrustedMembers
    );
    bot.addRoute(
        ["mideaoff", "acoff", "ac1off"],
        EmbassyHandlers.turnOffConditionerHandler,
        null,
        () => ["downstairs"],
        TrustedMembers
    );
    bot.addRoute(
        ["mideamode", "acmode", "ac1mode"],
        EmbassyHandlers.setConditionerModeHandler,
        /(\S+)/,
        match => ["downstairs", Number(match[1])],
        TrustedMembers
    );
    bot.addRoute(
        ["mideatemp", "actemp", "ac1temp"],
        EmbassyHandlers.setConditionerTempHandler,
        /(\d*)/,
        match => ["downstairs", Number(match[1])],
        TrustedMembers
    );
    bot.addRoute(
        ["mideaaddtemp", "acaddtemp", "ac1addtemp"],
        EmbassyHandlers.addConditionerTempHandler,
        CaptureInteger,
        match => ["downstairs", Number(match[1])],
        TrustedMembers
    );

    // Conditioner Upstairs
    bot.addRoute(["conditioner2", "ac2", "lg"], EmbassyHandlers.conditionerHandler, null, () => ["upstairs"], TrustedMembers);
    bot.addRoute(["lgon", "ac2on"], EmbassyHandlers.turnOnConditionerHandler, null, () => ["upstairs"], TrustedMembers);
    bot.addRoute(["lgoff", "ac2off"], EmbassyHandlers.turnOffConditionerHandler, null, () => ["upstairs"]);
    bot.addRoute(
        ["lgmode", "ac2mode"],
        EmbassyHandlers.setConditionerModeHandler,
        /(\S+)/,
        match => ["upstairs", Number(match[1])],
        TrustedMembers
    );
    bot.addRoute(
        ["lgtemp", "ac2temp"],
        EmbassyHandlers.setConditionerTempHandler,
        /(\d*)/,
        match => ["upstairs", Number(match[1])],
        TrustedMembers
    );
    bot.addRoute(
        ["lgaddtemp", "ac2addtemp"],
        EmbassyHandlers.addConditionerTempHandler,
        CaptureInteger,
        match => ["upstairs", Number(match[1])],
        TrustedMembers
    );

    bot.addRoute(["preheat"], EmbassyHandlers.preheatHandler, null, null, Members);

    // Sounds
    bot.addRoute(["sayinspace", "say", "announce"], EmbassyHandlers.sayinspaceHandler, OptionalParam(/(.*)/ims), match => [
        match[1],
    ]);
    bot.addRoute(["playinspace", "play"], EmbassyHandlers.playinspaceHandler, /(.*)/ims, match => [match[1]], TrustedMembers);
    bot.addRoute(["stopmedia", "stop"], EmbassyHandlers.stopMediaHandler, null, null, TrustedMembers);
    bot.addRoute(["availablesounds", "sounds"], EmbassyHandlers.availableSoundsHandler, null, null, TrustedMembers);
    bot.addRoute(["fartinspace", "fart"], EmbassyHandlers.playinspaceHandler, null, () => ["fart"], TrustedMembers);
    bot.addRoute(["moaninspace", "moan"], EmbassyHandlers.playinspaceHandler, null, () => ["moan"], TrustedMembers);
    bot.addRoute(
        ["rickroll", "nevergonnagiveyouup"],
        EmbassyHandlers.playinspaceHandler,
        null,
        () => ["rickroll"],
        TrustedMembers
    );
    bot.addRoute(["rzd"], EmbassyHandlers.playinspaceHandler, null, () => ["rzd"], TrustedMembers);
    bot.addRoute(["adler"], EmbassyHandlers.playinspaceHandler, null, () => ["adler"], TrustedMembers);
    bot.addRoute(["rfoxed", "rf0x1d"], EmbassyHandlers.playinspaceHandler, null, () => ["rfoxed"], TrustedMembers);
    bot.addRoute(["nani", "omaewamoushindeiru"], EmbassyHandlers.playinspaceHandler, null, () => ["nani"], TrustedMembers);
    bot.addRoute(
        ["zhuchok", "zhenya", "anya", "zhanya"],
        EmbassyHandlers.playinspaceHandler,
        null,
        () => ["zhuchok"],
        TrustedMembers
    );
    bot.addRoute(["badum", "badumtss"], EmbassyHandlers.playinspaceHandler, null, () => ["badumtss"], TrustedMembers);
    bot.addRoute(["sad", "sadtrombone"], EmbassyHandlers.playinspaceHandler, null, () => ["sad"], TrustedMembers);
    bot.addRoute(["dushno", "openwindow"], EmbassyHandlers.playinspaceHandler, null, () => ["dushno"], TrustedMembers);
    bot.addRoute(["anthem", "uk", "british"], EmbassyHandlers.playinspaceHandler, null, () => ["anthem"], TrustedMembers);
    bot.addRoute(["hey"], EmbassyHandlers.heyHandler);

    // Text
    bot.addRoute(["textinspace", "text"], EmbassyHandlers.textinspaceHandler, OptionalParam(/(.*)/ims), match => [match[1]]);
    bot.addRoute(["htmlinspace", "html"], EmbassyHandlers.htmlinspaceHandler, OptionalParam(/(.*)/ims), match => [match[1]]);
    bot.addRoute(["gifinspace", "gif"], EmbassyHandlers.gifinspaceHandler, OptionalParam(/(.*)/ims), match => [match[1]]);
    bot.addRoute(
        ["donationsummary", "textdonations"],
        EmbassyHandlers.sendDonationsSummaryHandler,
        OptionalParam(/(.*)/),
        match => [match[1]]
    );

    // Memes
    bot.addRoute(
        ["randomcab", "cab", "givemecab", "iwantcab", "ineedcab", "iwanttoseecab"],
        MemeHandlers.randomImagePathHandler,
        null,
        () => ["./resources/images/cab"]
    );

    // Checks
    if (botConfig.features.outage)
        bot.addRoute(["ena", "checkena", "checkoutages", "outages"], EmbassyHandlers.checkOutageMentionsHandler);

    // Cams
    bot.addRoute(
        ["downstairs", "webcam", "webcum", "cam", "cum", "firstfloor", "ff", "cam1a", "cum1a"],
        EmbassyHandlers.webcamHandler,
        null,
        () => ["downstairs"],
        Members
    );
    bot.addRoute(
        ["downstairs2", "firstfloor2", "ff2", "cam1b", "cum1b"],
        EmbassyHandlers.webcamHandler,
        null,
        () => ["downstairs2"],
        Members
    );
    bot.addRoute(
        ["upstairs", "webcam2", "webcum2", "cam2", "cum2", "secondfloor", "sf"],
        EmbassyHandlers.webcamHandler,
        null,
        () => ["upstairs"],
        Members
    );
    bot.addRoute(
        ["outdoors", "doorcam", "doorcum", "precam", "precum", "dc"],
        EmbassyHandlers.webcamHandler,
        null,
        () => ["outdoors"],
        Members
    );
    bot.addRoute(
        ["face", "facecam", "facecum", "facecontrol"],
        EmbassyHandlers.webcamHandler,
        null,
        () => ["facecontrol"],
        Members
    );
    bot.addRoute(["kitchen", "kitchencam", "kitchencum"], EmbassyHandlers.webcamHandler, null, () => ["kitchen"], Members);
    bot.addRoute(
        ["printerscam", "funroom", "funcam", "funcum"],
        EmbassyHandlers.webcamHandler,
        null,
        () => ["printers"],
        Members
    );
    bot.addRoute(["allcams", "cams", "allcums", "cums", "allc"], EmbassyHandlers.allCamsHandler, null, null, Members);

    // Sensors
    bot.addRoute(["climate", "temp"], EmbassyHandlers.climateHandler);

    // Devices
    bot.addRoute(
        ["gayming", "gaming"],
        EmbassyHandlers.deviceHandler,
        OptionalParam(/(status|help|up|down)/),
        match => ["gaming", match[1]],
        Members
    );

    // Network utils
    bot.addRoute(["isalive", "alive", "probe"], EmbassyHandlers.pingHandler, /(\S+)/, match => [match[1]], Members);
    bot.addRoute(["ping"], EmbassyHandlers.pingHandler, /(\S+)/, match => [match[1], true], Members);

    // Neural
    if (botConfig.features.ai) {
        bot.addRoute(
            ["txt2img", "img2img", "toimg", "sd", "generateimage"],
            EmbassyHandlers.stableDiffusiondHandler,
            OptionalParam(/(.*)/ims),
            match => [match[1]]
        );
        bot.addRoute(["ask", "gpt"], EmbassyHandlers.askHandler, OptionalParam(/(.*)/ims), match => [
            match[1],
            AvailableModels.GPT,
        ]);
        bot.addRoute(["ollama", "llama", "lama"], EmbassyHandlers.askHandler, OptionalParam(/(.*)/ims), match => [
            match[1],
            AvailableModels.OLLAMA,
        ]);
        bot.addRoute(["shouldigo", "shouldvisit", "shouldgo", "should"], StatusHandlers.shouldIGoHandler);
    }

    // Funds
    bot.addRoute(
        ["tocab", "givecab", "tc"],
        FundsHandlers.transferDonationHandler,
        CaptureListOfIds,
        match => [match[1], "CabiaRangris"],
        Accountants
    );
    bot.addRoute(
        ["tonick", "givenick", "tn"],
        FundsHandlers.transferDonationHandler,
        CaptureListOfIds,
        match => [match[1], "korn9509"],
        Accountants
    );
    bot.addRoute(
        ["tocaball", "givecaball", "givecaballmymoney", "tca"],
        FundsHandlers.transferAllToHandler,
        OptionalParam(/(.*)/),
        match => ["CabiaRangris", match[1]],
        Accountants
    );
}
