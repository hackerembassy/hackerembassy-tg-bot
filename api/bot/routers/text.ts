import { Router } from "express";
import config from "config";

import * as TextGenerators from "@hackembot/text";
import { stripCustomMarkup } from "@hackembot/core/helpers";

import UsersRepository from "@repositories/users";
import FundsRepository from "@repositories/funds";
import embassyService from "@services/embassy/embassy";

import { getClosestEventsFromCalendar, getTodayEvents, getTodayEventsCached } from "@services/external/googleCalendar";

import { BotApiConfig } from "@config";
import { userService } from "@services/domain/user";
import { spaceService } from "@services/domain/space";
const apiConfig = config.get<BotApiConfig>("api");

const router = Router();

const ApiTextCommandsList = [
    {
        command: "status",
        description: "Статус спейса и кто отметился внутри",
        regex: "^status$",
    },
    {
        command: "join",
        description: "Как присоединиться к нам",
        regex: "^join$",
    },
    {
        command: "donate",
        description: "Как задонатить",
        regex: "^donate$",
    },
    {
        command: "funds",
        description: "Наши открытые сборы",
        regex: "^funds$",
    },
    {
        command: "sponsors",
        description: "Наши почетные спонсоры",
        regex: "^sponsors$",
    },
    {
        command: "events",
        description: "Мероприятия у нас",
        regex: "^events$",
    },
];

const ApiCalendarCommandsList = [
    {
        command: "upcoming",
        description: "Ближайшие мероприятия",
        regex: "^upcoming$",
    },
    {
        command: "today",
        description: "Мероприятия сегодня",
        regex: "^today$",
    },
];

const CombinedCommandsList = apiConfig.features.calendar
    ? [...ApiTextCommandsList, ...ApiCalendarCommandsList]
    : ApiTextCommandsList;

router.get("/", (_, res) => {
    res.json(CombinedCommandsList);
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
        const events = await getClosestEventsFromCalendar();
        const messageText = TextGenerators.getEventsList(events);
        res.send(messageText);
    });

    router.get("/today", async (_, res) => {
        const messageText = TextGenerators.getTodayEventsText(await getTodayEventsCached());
        res.send(messageText);
    });
}

router.get("/funds", async (_, res) => {
    const funds = FundsRepository.getAllFunds().filter(p => p.status === "open");
    const donations = FundsRepository.getAllDonations(true, true);

    const list = await TextGenerators.createFundList(funds, donations, { showAdmin: false, isApi: true });

    const message = `⚒ Вот наши текущие сборы:

  ${list}💸 Чтобы узнать, как нам помочь - пиши donate`;

    res.send(message);
});

router.get("/donate", (_, res) => {
    const accountants = UsersRepository.getUsersByRole("accountant");
    const message = TextGenerators.getDonateText(accountants, true);
    res.send(message);
});

router.get("/sponsors", (_, res) => {
    const sponsors = UsersRepository.getSponsors();
    const message = TextGenerators.getSponsorsList(sponsors, true);
    res.send(message);
});

router.get("/status", async (_, res) => {
    const state = spaceService.getState();
    let content = `🔐 Статус спейса неопределен`;

    const inside = userService.getPeopleInside();
    const going = userService.getPeopleGoing();
    const climateInfo = await embassyService.getSpaceClimate().catch(() => null);
    const todayEvents = apiConfig.features.calendar ? await getTodayEvents() : null;

    content = TextGenerators.getStatusMessage(state, inside, going, todayEvents, climateInfo, {
        short: false,
        withSecrets: false,
        isApi: true,
    });

    res.send(stripCustomMarkup(content));
});

export default router;
