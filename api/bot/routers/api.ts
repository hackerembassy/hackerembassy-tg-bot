import { Router } from "express";

import { State, User, UserState } from "@data/models";

import StatusHandlers from "@hackembot/handlers/status";
import FundsRepository from "@repositories/funds";
import StatusRepository from "@repositories/status";
import UsersRepository from "@repositories/users";

import { getDonationsSummary } from "@services/export";
import logger from "@services/logger";
import {
    filterAllPeopleInside,
    filterPeopleGoing,
    filterPeopleInside,
    SpaceStateService,
    UserStateService,
} from "@services/status";
import wiki from "@services/wiki";
import { createTokenSecuredMiddleware } from "@utils/middleware";
import { ServiceUsers } from "@services/user";

const router = Router();

const hassTokenRequired = createTokenSecuredMiddleware(logger, process.env["UNLOCKKEY"]);
const hassTokenOptional = createTokenSecuredMiddleware(logger, process.env["UNLOCKKEY"], true);
const guestTokenRequired = createTokenSecuredMiddleware(logger, process.env["GUESTKEY"]);

const createSpaceApiResponse = (status: State & { changer: User }, inside: UserState[]) => ({
    api: "0.13",
    api_compatibility: ["14"],
    space: "Hacker Embassy",
    logo: "https://gateway.hackem.cc/static/hackemlogo.jpg",
    url: "https://hackem.cc/",
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
        open: !!status.open,
        message: status.open ? "open for public" : "closed for public",
        trigger_person: status.changer.username,
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
            url: "https://wiki.hackem.cc/ru/home",
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

router.get("/space", (_, res) => {
    const status = StatusRepository.getSpaceLastState();
    const inside = UserStateService.getRecentUserStates().filter(filterPeopleInside);

    if (!status)
        return res.status(500).json({
            error: "Status is not defined",
        });

    return res.json(createSpaceApiResponse(status, inside));
});

router.get("/status", hassTokenOptional, (req, res) => {
    const status = StatusRepository.getSpaceLastState();

    if (!status)
        return res.status(500).json({
            error: "Status is not defined",
        });

    const recentUserStates = UserStateService.getRecentUserStates();

    const inside = recentUserStates.filter(req.authenticated ? filterAllPeopleInside : filterPeopleInside).map(p => {
        return {
            username: p.user.username,
            dateChanged: p.date,
        };
    });
    const planningToGo = recentUserStates.filter(filterPeopleGoing).map(p => {
        return {
            username: p.user.username,
            dateChanged: p.date,
        };
    });

    return res.json({
        open: status.open,
        dateChanged: status.date,
        changedBy: status.changer.username,
        inside,
        planningToGo,
    });
});

router.get("/inside", hassTokenOptional, (req, res) => {
    const inside = UserStateService.getRecentUserStates().filter(req.authenticated ? filterAllPeopleInside : filterPeopleInside);
    res.json(inside);
});

// Legacy HASS api
router.get("/insidecount", hassTokenOptional, (req, res) => {
    try {
        const inside = UserStateService.getRecentUserStates().filter(
            req.authenticated ? filterAllPeopleInside : filterPeopleInside
        );
        res.status(200).send(inside.length.toString());
    } catch {
        res.status(500).send("-1");
    }
});

router.post("/setgoing", guestTokenRequired, (req, res) => {
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

        if (typeof body.username !== "string" || typeof body.isgoing !== "boolean")
            return res.status(400).send({ error: "Missing or incorrect parameters" });

        const user = UsersRepository.getUserByName(body.username);

        if (!user) return res.status(400).send({ error: `Missing user with ${body.username}` });

        StatusHandlers.setGoingState(user, body.isgoing, body.message);

        return res.json({ message: "Success" });
    } catch (error) {
        return res.status(500).send({ error });
    }
});

router.post("/open", hassTokenRequired, (_, res) => {
    /*  #swagger.requestBody = {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref : '#/definitions/withHassToken' }  
                    }
                }
            
        } */
    SpaceStateService.openSpace(ServiceUsers.hass);

    return res.send({ message: "Success" });
});

router.post("/close", hassTokenRequired, (_, res) => {
    /*  #swagger.requestBody = {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref : '#/definitions/withHassToken' }  
                    }
                }
            
        } */
    SpaceStateService.closeSpace(ServiceUsers.hass);
    UserStateService.evictPeople();

    return res.send({ message: "Success" });
});

router.get("/donations", async (req, res) => {
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

    return res.json(await getDonationsSummary(fund, limit));
});

router.get("/wiki/list", async (req, res, next) => {
    try {
        const lang = req.query.lang as string | undefined;
        const list = await wiki.listPages(lang);

        res.json(list);
    } catch (error) {
        next(error);
    }
});

router.get("/wiki/tree", async (req, res, next) => {
    try {
        const lang = req.query.lang as string | undefined;
        const list = await wiki.listPagesAsTree(lang);

        res.json(list);
    } catch (error) {
        next(error);
    }
});

router.get("/wiki/page/:id", async (req, res, next) => {
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

export default router;
