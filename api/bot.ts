import config from "config";
import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import swaggerUi from "swagger-ui-express";

import StatusHandlers from "../bot/handlers/status";
import { BotApiConfig, BotConfig } from "../config/schema";
import Donation from "../models/Donation";
import FundsRepository from "../repositories/fundsRepository";
import StatusRepository from "../repositories/statusRepository";
import UsersRepository from "../repositories/usersRepository";
import { requestToEmbassy } from "../services/embassy";
import { getClosestEventsFromCalendar, getTodayEvents } from "../services/googleCalendar";
import { SpaceClimate } from "../services/hass";
import logger from "../services/logger";
import {
    closeSpace,
    filterAllPeopleInside,
    filterPeopleGoing,
    filterPeopleInside,
    openSpace,
    UserStateService,
} from "../services/statusHelper";
import * as TextGenerators from "../services/textGenerators";
import { getEventsList } from "../services/textGenerators";
import wiki from "../services/wiki";
import { stripCustomMarkup } from "../utils/common";
import { convertCurrency } from "../utils/currency";
import { createErrorMiddleware, createTokenSecuredMiddleware, tokenPresent } from "../utils/middleware";

const apiConfig = config.get<BotApiConfig>("api");
const botConfig = config.get<BotConfig>("bot");

const app = express();
const port = apiConfig.port;
const tokenHassSecured = createTokenSecuredMiddleware(logger, process.env["UNLOCKKEY"]);
const tokenGuestSecured = createTokenSecuredMiddleware(logger, process.env["GUESTKEY"]);

app.use(cors());
app.use(express.json());
app.use(createErrorMiddleware(logger));
app.use("/static", express.static(path.join(__dirname, botConfig.static)));

// Add Swagger if exists
try {
    const swaggerFile = fs.readFileSync(path.resolve(__dirname, "swagger-schema.json"));
    const swaggerDocument = JSON.parse(swaggerFile.toString());
    app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (error) {
    logger.error(error);
}

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

// Routes
app.get("/api/text", (_, res) => {
    res.json(ApiTextCommandsList);
});

app.get("/text/status", async (_, res) => {
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

app.get("/api/status", (req, res) => {
    const showAllPeople = tokenPresent(req, process.env["UNLOCKKEY"]);
    const status = StatusRepository.getSpaceLastState();

    if (!status) {
        res.json({
            error: "Status is not defined",
        });
        return;
    }

    const recentUserStates = UserStateService.getRecentUserStates();

    const inside = recentUserStates.filter(showAllPeople ? filterAllPeopleInside : filterPeopleInside).map(p => {
        return {
            username: p.username,
            dateChanged: p.date,
        };
    });
    const planningToGo = recentUserStates.filter(filterPeopleGoing).map(p => {
        return {
            username: p.username,
            dateChanged: p.date,
        };
    });

    res.json({
        open: status.open,
        dateChanged: status.date,
        changedBy: status.changedby,
        inside,
        planningToGo,
    });
});

app.get("/api/space", (_, res) => {
    const status = StatusRepository.getSpaceLastState();
    const recentUserStates = UserStateService.getRecentUserStates();

    const inside = recentUserStates.filter(filterPeopleInside);

    res.json({
        api: "0.13",
        api_compatibility: ["14"],
        space: "Hacker Embassy",
        logo: "https://gateway.hackerembassy.site/static/hackemlogo.jpg",
        url: "https://hackerembassy.site/",
        location: {
            address: "Pushkina str. 38/18, Yerevan, Armenia",
            lon: 44.51338,
            lat: 40.18258,
            timezone: "Asia/Yerevan",
        },
        contact: {
            email: "hacker.embassy@proton.me",
            matrix: "#hacker-embassy:matrix.org",
            telegram: "@hacker_embassy",
        },
        issue_report_channels: ["email"],
        state: {
            open: !!status?.open,
            message: status?.open ? "open for public" : "closed for public",
            trigger_person: status?.changedby,
        },
        sensors: {
            people_now_present: [{ value: inside.length }],
        },
        projects: ["https://github.com/hackerembassy"],
        feeds: {
            calendar: {
                type: "ical",
                url: "https://calendar.google.com/calendar/ical/9cdc565d78854a899cbbc7cb6dfcb8fa411001437ae0f66bce0a82b5e7679d5e@group.calendar.google.com/public/basic.ics",
            },
        },
        links: [
            {
                name: "Wiki",
                url: "https://wiki.hackerembassy.site/ru/home",
            },
            {
                name: "Status of public services",
                url: "https://uptime.hackem.cc/status/external",
            },
            {
                name: "Instagram",
                url: "https://www.instagram.com/hackerembassy",
            },
        ],
        membership_plans: [
            {
                name: "Membership",
                value: 100,
                currency: "USD",
                billing_interval: "monthly",
            },
        ],
    });
});

app.get("/api/inside", (req, res) => {
    const showAllPeople = tokenPresent(req, process.env["UNLOCKKEY"]);
    const inside = UserStateService.getRecentUserStates().filter(showAllPeople ? filterAllPeopleInside : filterPeopleInside);
    res.json(inside);
});

app.get("/api/insidecount", (req, res) => {
    try {
        const showAllPeople = tokenPresent(req, process.env["UNLOCKKEY"]);
        const inside = UserStateService.getRecentUserStates().filter(showAllPeople ? filterAllPeopleInside : filterPeopleInside);
        res.status(200).send(inside.length.toString());
    } catch {
        res.status(500).send("-1");
    }
});

app.post("/api/setgoing", tokenGuestSecured, (req, res) => {
    /*  #swagger.requestBody = {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref : '#/definitions/going' }  
                    }
                }
            
        } */
    try {
        const body = req.body as { username: string; isgoing: boolean; message?: string };

        if (typeof body.username !== "string" || typeof body.isgoing !== "boolean") {
            res.status(400).send({ error: "Missing or incorrect parameters" });
            return;
        }

        StatusHandlers.setGoingState(body.username, body.isgoing, body.message);

        res.json({ message: "Success" });
    } catch (error) {
        res.status(500).send({ error });
    }
});

app.post("/api/open", tokenHassSecured, (_, res) => {
    /*  #swagger.requestBody = {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref : '#/definitions/withHassToken' }  
                    }
                }
            
        } */
    openSpace("hass");

    return res.send({ message: "Success" });
});

app.post("/api/close", tokenHassSecured, (_, res) => {
    /*  #swagger.requestBody = {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref : '#/definitions/withHassToken' }  
                    }
                }
            
        } */
    closeSpace("hass", { evict: true });

    return res.send({ message: "Success" });
});

app.get("/api/donations", async (req, res) => {
    /*  #swagger.parameters['fund'] = {
                in: 'query',
                description: 'Fund name to show donations for. By default shows the latest fund for costs',
                required: false,
                type: 'string'
        } */
    /*  #swagger.parameters['limit'] = {
                in: 'query',
                description: 'Limit of donations to show. By default shows all donations',
                required: false,
                type: 'number'
        } */

    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    if (limit !== undefined && (isNaN(limit) || limit < 0)) return res.status(400).send({ error: "Invalid limit" });

    const fund = req.query.fund ? FundsRepository.getFundByName(req.query.fund as string) : FundsRepository.getLatestCosts();
    if (!fund) return res.status(500).send({ error: "Costs fund is not found" });

    const donations = FundsRepository.getDonationsForName(fund.name) as (Donation & { converted_value?: number })[];

    for (const donation of donations) {
        donation.converted_value = (await convertCurrency(donation.value, donation.currency, fund.target_currency)) ?? -1;
    }

    const resultDonations = donations
        .sort((a, b) => b.converted_value! - a.converted_value!)
        .slice(0, limit)
        .map((d, index) => ({
            rank: index + 1,
            username: d.username,
            value: d.value,
            currency: d.currency,
            converted_value: d.converted_value,
            combined_value: `${d.value} ${d.currency}`,
        }));

    // Processing data for HASS
    const collected_value = parseFloat(resultDonations.reduce((acc, d) => acc + d.converted_value!, 0).toFixed(2));
    const ranked_donations = resultDonations.map(d => `${d.rank}. ${d.username} - ${d.combined_value}`).join("    ");
    const fund_stats = `${fund.name} - ${collected_value} out of ${fund.target_value} ${fund.target_currency}`;

    return res.send({
        fund: {
            name: fund.name,
            target_value: fund.target_value,
            collected_value,
            target_currency: fund.target_currency,
            status: fund.status,
        },
        donations: resultDonations,
        strings: {
            ranked_donations,
            fund_stats,
        },
    });
});

app.get("/text/join", (_, res) => {
    const message = TextGenerators.getJoinText(true);
    res.send(message);
});

app.get("/text/events", (_, res) => {
    const message = TextGenerators.getEventsText(true);
    res.send(message);
});

app.get("/text/upcoming", async (_, res) => {
    const events = await getClosestEventsFromCalendar(botConfig.calendar.upcomingToLoad);
    const messageText = getEventsList(events);
    res.send(messageText);
});

app.get("/text/today", async (_, res) => {
    const messageText = TextGenerators.getTodayEventsText(await getTodayEvents());
    res.send(messageText);
});

app.get("/text/funds", async (_, res) => {
    const funds = FundsRepository.getFunds()?.filter(p => p.status === "open");
    const donations = FundsRepository.getDonations();

    const list = await TextGenerators.createFundList(funds, donations, { showAdmin: false, isApi: true });

    const message = `⚒ Вот наши текущие сборы:

  ${list}💸 Чтобы узнать, как нам помочь - пиши donate`;

    res.send(message);
});

app.get("/text/donate", (_, res) => {
    const accountants = UsersRepository.getUsersByRole("accountant");
    const message = TextGenerators.getDonateText(accountants, true);
    res.send(message);
});

app.get("/healthcheck", (_, res, next) => {
    try {
        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

app.get("/api/wiki/list", async (req, res, next) => {
    try {
        const lang = req.query.lang as string | undefined;
        const list = await wiki.listPages(lang);

        res.json(list);
    } catch (error) {
        next(error);
    }
});

app.get("/api/wiki/tree", async (req, res, next) => {
    try {
        const lang = req.query.lang as string | undefined;
        const list = await wiki.listPagesAsTree(lang);

        res.json(list);
    } catch (error) {
        next(error);
    }
});

app.get("/api/wiki/page/:id", async (req, res, next) => {
    try {
        if (!req.params.id) {
            res.status(400).send({ error: "Missing page id" });
            return;
        }

        const pageId = Number(req.params.id);

        if (isNaN(pageId)) {
            res.status(400).send({ error: "Invalid page id" });
            return;
        }

        const page = await wiki.getPage(Number(pageId));

        res.json(page);
    } catch (error) {
        next(error);
    }
});

export function StartSpaceApi() {
    app.listen(port);
    logger.info(`Bot Api is ready to accept requests on port ${port}`);
}
