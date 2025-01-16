import { Router, Request } from "express";

import { User } from "@data/models";
import StatusHandlers from "@hackembot/handlers/status";
import FundsRepository from "@repositories/funds";
import StatusRepository from "@repositories/status";
import UsersRepository from "@repositories/users";

import { getDonationsSummary, SponsorshipLevel, SponsorshipLevelToName } from "@services/export";
import {
    filterAllPeopleInside,
    filterPeopleGoing,
    filterPeopleInside,
    SpaceStateService,
    UserStateService,
} from "@services/status";
import { hasRole } from "@services/user";

import wikiRouter from "./wiki";
import embassyRouter from "./embassy";
import { spaceApiTemplate } from "../templates";
import { authentificate, allowTrustedMembers, allowMembers } from "../middleware";

// Router
const apiRouter = Router();
apiRouter.use(authentificate);
apiRouter.use("/wiki", wikiRouter);
apiRouter.use("/embassy", embassyRouter);

// Helpers
const isFromMemberOrHass = (req: Request): boolean => req.entity === "hass" || (req.user && hasRole(req.user as User, "member"));

// Routes
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

apiRouter.get("/status", (req, res) => {
    const status = StatusRepository.getSpaceLastState();

    const recentUserStates = UserStateService.getRecentUserStates();

    const inside = recentUserStates.filter(isFromMemberOrHass(req) ? filterAllPeopleInside : filterPeopleInside).map(p => {
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

apiRouter.get("/inside", (req, res) => {
    const inside = UserStateService.getRecentUserStates().filter(
        isFromMemberOrHass(req) ? filterAllPeopleInside : filterPeopleInside
    );
    res.json(inside);
});

// Legacy HASS api
apiRouter.get("/insidecount", (req, res) => {
    try {
        const inside = UserStateService.getRecentUserStates().filter(
            isFromMemberOrHass(req) ? filterAllPeopleInside : filterPeopleInside
        );
        res.status(200).send(inside.length.toString());
    } catch {
        res.status(500).send("-1");
    }
});

apiRouter.post("/setgoing", allowTrustedMembers, (req, res) => {
    /*  #swagger.requestBody = {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref : '#/definitions/going' }  
                    }
                }
            
        } */
    try {
        const body = req.body as { isgoing: boolean; message?: string };

        if (typeof body.isgoing !== "boolean") return res.status(400).send({ error: "Missing or incorrect parameters" });

        StatusHandlers.setGoingState(req.user as User, body.isgoing, body.message);

        return res.json({ message: "Success" });
    } catch (error) {
        return res.status(500).send({ error });
    }
});

apiRouter.post("/in", allowTrustedMembers, (req, res) => {
    const success = UserStateService.LetIn(req.user as User);

    return res.send({ message: success ? "Success" : "Failed" });
});

apiRouter.post("/out", allowTrustedMembers, (req, res) => {
    const success = UserStateService.LetOut(req.user as User);

    return res.send({ message: success ? "Success" : "Failed" });
});

apiRouter.post("/open", allowMembers, (req, res) => {
    SpaceStateService.openSpace(req.user as User);

    return res.send({ message: "Success" });
});

apiRouter.post("/close", allowMembers, (req, res) => {
    SpaceStateService.closeSpace(req.user as User);
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

apiRouter.get("/sponsors", (req, res) => {
    const sponsors = UsersRepository.getSponsors();
    res.json(
        sponsors.map(s => {
            return {
                userid: isFromMemberOrHass(req) ? s.userid : undefined,
                username: s.username,
                first_name: s.first_name,
                sponsorship: SponsorshipLevelToName.get(s.sponsorship as SponsorshipLevel),
            };
        })
    );
});

export default apiRouter;
