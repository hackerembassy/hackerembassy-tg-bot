import { Router } from "express";

import StatusHandlers from "@hackembot/handlers/status";
import FundsRepository from "@repositories/funds";
import StatusRepository from "@repositories/status";
import UsersRepository from "@repositories/users";

import { getDonationsSummary, SponsorshipLevel, SponsorshipLevelToName } from "@services/export";
import logger from "@services/logger";
import {
    filterAllPeopleInside,
    filterPeopleGoing,
    filterPeopleInside,
    SpaceStateService,
    UserStateService,
} from "@services/status";
import { createTokenSecuredMiddleware } from "@utils/middleware";
import { SERVICE_USERS } from "@data/seed";
import { readFirstExistingFile } from "@utils/filesystem";

import wikiRouter from "./wiki";

function loadSpaceApiTemplate() {
    try {
        const spaceApiFile = readFirstExistingFile("./config/spaceapi.local.json", "./config/spaceapi.json");

        return spaceApiFile ? (JSON.parse(spaceApiFile) as object) : undefined;
    } catch (error) {
        logger.error(error);
        return undefined;
    }
}

const apiRouter = Router();
apiRouter.use("/wiki", wikiRouter);

const hassTokenRequired = createTokenSecuredMiddleware(logger, process.env["UNLOCKKEY"]);
const hassTokenOptional = createTokenSecuredMiddleware(logger, process.env["UNLOCKKEY"], true);
const guestTokenRequired = createTokenSecuredMiddleware(logger, process.env["GUESTKEY"]);

const spaceApiTemplate = loadSpaceApiTemplate();

apiRouter.get("/space", (_, res) => {
    const status = StatusRepository.getSpaceLastState();
    const inside = UserStateService.getRecentUserStates().filter(filterPeopleInside);

    if (!spaceApiTemplate)
        return res.status(500).json({
            error: "SpaceApi template is not defined",
        });

    return res.json({
        ...spaceApiTemplate,
        state: {
            open: !!status.open,
            message: status.open ? "open for public" : "closed for public",
            trigger_person: status.changer.username,
        },
        sensors: {
            people_now_present: [{ value: inside.length }],
        },
    });
});

apiRouter.get("/status", hassTokenOptional, (req, res) => {
    const status = StatusRepository.getSpaceLastState();

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

apiRouter.get("/inside", hassTokenOptional, (req, res) => {
    const inside = UserStateService.getRecentUserStates().filter(req.authenticated ? filterAllPeopleInside : filterPeopleInside);
    res.json(inside);
});

// Legacy HASS api
apiRouter.get("/insidecount", hassTokenOptional, (req, res) => {
    try {
        const inside = UserStateService.getRecentUserStates().filter(
            req.authenticated ? filterAllPeopleInside : filterPeopleInside
        );
        res.status(200).send(inside.length.toString());
    } catch {
        res.status(500).send("-1");
    }
});

apiRouter.post("/setgoing", guestTokenRequired, (req, res) => {
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

apiRouter.post("/open", hassTokenRequired, (_, res) => {
    /*  #swagger.requestBody = {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref : '#/definitions/withHassToken' }  
                    }
                }
            
        } */
    SpaceStateService.openSpace(SERVICE_USERS.hass);

    return res.send({ message: "Success" });
});

apiRouter.post("/close", hassTokenRequired, (_, res) => {
    /*  #swagger.requestBody = {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref : '#/definitions/withHassToken' }  
                    }
                }
            
        } */
    SpaceStateService.closeSpace(SERVICE_USERS.hass);
    UserStateService.evictPeople();

    return res.send({ message: "Success" });
});

apiRouter.get("/donations", async (req, res) => {
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

apiRouter.get("/sponsors", hassTokenOptional, (req, res) => {
    const sponsors = UsersRepository.getSponsors();
    res.json(
        sponsors.map(s => {
            return {
                userid: req.authenticated ? s.userid : undefined,
                username: s.username,
                first_name: s.first_name,
                sponsorship: SponsorshipLevelToName.get(s.sponsorship as SponsorshipLevel),
            };
        })
    );
});

export default apiRouter;
