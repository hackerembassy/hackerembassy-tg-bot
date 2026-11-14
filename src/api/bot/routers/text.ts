import { Router } from "express";
import config from "config";

import * as TextGenerators from "@hackembot/text";
import { stripCustomMarkup } from "@hackembot/core/converters";
import t, { PUBLIC_LANGUAGES, RequestLanguage, SupportedLanguage } from "@hackembot/core/localization";

import { fundsService } from "@services/domain/funds";
import embassyService from "@services/embassy/embassy";

import { getTodayEventsCached, getUpcomingEventsCached } from "@services/external/googleCalendar";

import { BotApiConfig } from "@config";
import { userService } from "@services/domain/user";
import { spaceService } from "@services/domain/space";
const apiConfig = config.get<BotApiConfig>("api");

const router = Router();

const PublicLanguageCodes: readonly SupportedLanguage[] = PUBLIC_LANGUAGES.map(lang => lang.code);

// ?lang=en etc. switches the language of all text responses; the internal test locale is not public
router.use((req, _, next) => {
    const lang = PublicLanguageCodes.find(code => code === req.query.lang);
    if (lang) RequestLanguage.run(lang, next);
    else next();
});

const ApiTextCommandsList = [
    {
        command: "status",
        regex: "^status$",
    },
    {
        command: "join",
        regex: "^join$",
    },
    {
        command: "location",
        regex: "^location$",
    },
    {
        command: "donate",
        regex: "^donate$",
    },
    {
        command: "funds",
        regex: "^funds$",
    },
    {
        command: "sponsors",
        regex: "^sponsors$",
    },
    {
        command: "events",
        regex: "^events$",
    },
];

const ApiCalendarCommandsList = [
    {
        command: "upcoming",
        regex: "^upcoming$",
    },
    {
        command: "today",
        regex: "^today$",
    },
];

const CombinedCommandsList = apiConfig.features.calendar
    ? [...ApiTextCommandsList, ...ApiCalendarCommandsList]
    : ApiTextCommandsList;

router.get("/", (_, res) => {
    // Varies only by ?lang=, which is part of the URL
    res.set("Cache-Control", "public, max-age=60").json(
        CombinedCommandsList.map(c => ({ ...c, description: t(`api.commands.${c.command}`) }))
    );
});

router.get("/join", (_, res) => {
    const message = TextGenerators.getJoinText(true);
    res.send(message);
});

router.get("/events", (_, res) => {
    const message = TextGenerators.getEventsText(apiConfig.features.calendar, undefined, true);
    res.send(message);
});

if (apiConfig.features.calendar) {
    router.get("/upcoming", async (_, res) => {
        const events = await getUpcomingEventsCached();
        const messageText = TextGenerators.getEventsList(events, false, true);
        res.send(messageText);
    });

    router.get("/today", async (_, res) => {
        const messageText = TextGenerators.getTodayEventsText(await getTodayEventsCached(), true);
        res.send(messageText);
    });
}

router.get("/funds", async (_, res) => {
    const funds = fundsService.getFundsByStatus("open");
    const donations = fundsService.getAllDonations(true, true);

    const list = await TextGenerators.createFundList(funds, donations, { showAdmin: false, isApi: true }, { mention: false });

    const message = t("funds.funds", { list, donateCommand: "donate" });

    res.send(message);
});

router.get("/location", (_, res) => {
    res.send(t("basic.location.address"));
});

router.get("/donate", (_, res) => {
    const accountants = userService.getUsersByRole("accountant");
    const message = TextGenerators.getDonateText(accountants, true);
    res.send(message);
});

router.get("/sponsors", (_, res) => {
    const sponsors = userService.getSponsors();
    const message = TextGenerators.getSponsorsList(sponsors, true);
    res.send(message);
});

router.get("/status", async (_, res) => {
    const state = spaceService.getState();
    const inside = userService.getPeopleInside();
    const going = userService.getPeopleGoing();
    const climateInfo = await embassyService.getSpaceClimateCached();
    const todayEvents = apiConfig.features.calendar ? await getTodayEventsCached() : null;

    const content = TextGenerators.getStatusMessage(state, inside, going, todayEvents, climateInfo, {
        short: false,
        withSecrets: false,
        isApi: true,
    });

    res.send(stripCustomMarkup(content));
});

export default router;
