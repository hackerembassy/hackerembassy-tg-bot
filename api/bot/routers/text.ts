import { Router } from "express";

import * as TextGenerators from "@hackembot/textGenerators";
import { stripCustomMarkup } from "@hackembot/core/helpers";

import StatusRepository from "@repositories/status";
import UsersRepository from "@repositories/users";
import FundsRepository from "@repositories/funds";
import { requestToEmbassy } from "@services/embassy";
import { getClosestEventsFromCalendar, getTodayEvents } from "@services/googleCalendar";
import { SpaceClimate } from "@services/hass";
import { filterPeopleGoing, filterPeopleInside, UserStateService } from "@services/statusHelper";

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
        command: "events",
        description: "Мероприятия у нас",
        regex: "^events$",
    },
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

router.get("/", (_, res) => {
    res.json(ApiTextCommandsList);
});

router.get("/join", (_, res) => {
    const message = TextGenerators.getJoinText(true);
    res.send(message);
});

router.get("/events", (_, res) => {
    const message = TextGenerators.getEventsText(true);
    res.send(message);
});

router.get("/upcoming", async (_, res) => {
    const events = await getClosestEventsFromCalendar();
    const messageText = TextGenerators.getEventsList(events);
    res.send(messageText);
});

router.get("/today", async (_, res) => {
    const messageText = TextGenerators.getTodayEventsText(await getTodayEvents());
    res.send(messageText);
});

router.get("/funds", async (_, res) => {
    const funds = FundsRepository.getFunds()?.filter(p => p.status === "open");
    const donations = FundsRepository.getDonations();

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

router.get("/status", async (_, res) => {
    const state = StatusRepository.getSpaceLastState();
    let content = `🔐 Статус спейса неопределен`;

    if (state) {
        const allUserStates = UserStateService.getRecentUserStates();
        const inside = allUserStates.filter(filterPeopleInside);
        const going = allUserStates.filter(filterPeopleGoing);
        const climateResponse = await requestToEmbassy(`/climate`);
        const climateInfo = (await climateResponse.json()) as SpaceClimate;

        content = TextGenerators.getStatusMessage(
            state,
            inside,
            going,
            climateInfo,
            { mention: true },
            {
                short: false,
                withSecrets: false,
                isApi: true,
            }
        );
    }

    res.send(stripCustomMarkup(content));
});

export default router;
