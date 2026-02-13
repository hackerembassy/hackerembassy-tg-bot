import { Router, Request } from "express";
import config from "config";

import { User } from "@data/models";
import FundsRepository from "@repositories/funds";
import UsersRepository from "@repositories/users";

import { getFundDonationsSummary, SponsorshipLevel, SponsorshipLevelToName } from "@services/funds/export";
import { spaceService } from "@services/domain/space";
import logger from "@services/common/logger";
import { hasRole, userService } from "@services/domain/user";
import { donateToFund } from "@services/funds/donation";
import { SERVICE_USERS } from "@data/seed";

import bot from "@hackembot/instance";
import FundsController from "@hackembot/controllers/funds";
import { BotConfig } from "@config";
const botConfig = config.get<BotConfig>("bot");

import { getRequestIp } from "@utils/express";

import wikiRouter from "./wiki";
import embassyRouter from "./embassy";
import { spaceApiTemplate } from "../templates";
import { authentificate, allowTrustedMembers, allowMembers, allowSpecialEntities } from "../middleware";

// Router
const apiRouter = Router();
apiRouter.use(authentificate);
apiRouter.use("/wiki", wikiRouter);
apiRouter.use("/embassy", embassyRouter);

// Helpers
const isFromMemberOrHass = (req: Request): boolean => req.entity === "hass" || (req.user && hasRole(req.user as User, "member"));

// Routes
apiRouter.get("/space", (_, res) => {
    const status = spaceService.getState();
    const inside = userService.getPeopleInside();

    if (!spaceApiTemplate)
        return void res.status(500).json({
            error: "SpaceApi template is not defined",
        });

    res.json({
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
    const status = spaceService.getState();

    const inside = userService.getPeopleInside(isFromMemberOrHass(req)).map(p => {
        return {
            username: p.user.username,
            dateChanged: p.date,
        };
    });
    const planningToGo = userService.getPeopleGoing().map(p => {
        return {
            username: p.user.username,
            dateChanged: p.date,
        };
    });

    res.json({
        open: status.open,
        dateChanged: status.date,
        changedBy: status.changer.username,
        inside,
        planningToGo,
    });
});

apiRouter.get("/inside", (req, res) => {
    const inside = userService.getPeopleInside(isFromMemberOrHass(req));
    res.json(inside);
});

// Legacy HASS api
apiRouter.get("/insidecount", (req, res) => {
    try {
        const inside = userService.getPeopleInside(isFromMemberOrHass(req));
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

        if (typeof body.isgoing !== "boolean") return void res.status(400).send({ error: "Missing or incorrect parameters" });

        userService.setGoingState(req.user as User, body.isgoing, body.message);

        res.json({ message: "Success" });
    } catch (error) {
        res.status(500).send({ error });
    }
});

apiRouter.post("/in", allowTrustedMembers, (req, res) => {
    const success = userService.letIn(req.user as User);

    res.send({ message: success ? "Success" : "Failed" });
});

apiRouter.post("/out", allowTrustedMembers, (req, res) => {
    const success = userService.letOut(req.user as User);

    res.send({ message: success ? "Success" : "Failed" });
});

apiRouter.post("/open", allowMembers, (req, res) => {
    spaceService.openSpace(req.user as User);

    res.send({ message: "Success" });
});

apiRouter.post("/close", allowMembers, (req, res) => {
    spaceService.closeSpace(req.user as User);
    userService.evictPeople();

    res.send({ message: "Success" });
});

// TODO: replace with new funds api below when hass and matrix are updated
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
    if (limit !== undefined && (isNaN(limit) || limit < 0)) return void res.status(400).send({ error: "Invalid limit" });

    const fund = req.query.fund ? FundsRepository.getFundByName(req.query.fund as string) : FundsRepository.getLatestCosts();
    if (!fund) return void res.status(500).send({ error: "Costs fund is not found" });

    res.json(await getFundDonationsSummary(fund, limit));
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

apiRouter.get("/usernames", allowSpecialEntities, (_, res) => {
    const users = UsersRepository.getUsers();

    res.json(users.filter(u => u.username).map(u => u.username));
});

apiRouter.get("/funds", allowSpecialEntities, (req, res) => {
    const status = req.query.status as string | undefined;

    switch (status) {
        case "open":
        case "closed":
        case "suspended":
            return void res.json(FundsRepository.getFundsByStatus(status));
        case "all":
        case undefined:
            return void res.json(FundsRepository.getAllFunds());
        default:
            return void res.status(400).send({ error: "Invalid status" });
    }
});

apiRouter.get("/funds/:id", allowSpecialEntities, async (req, res) => {
    if (isNaN(Number(req.params.id))) return void res.status(400).send({ error: "Invalid fund id" });

    const fund = FundsRepository.getFundById(Number(req.params.id));

    if (!fund) return void res.status(404).send({ error: "Fund is not found" });

    res.json(await getFundDonationsSummary(fund));
});

apiRouter.post("/funds/:id/donations", allowSpecialEntities, async (req, res) => {
    /*  #swagger.parameters['id'] = {
                in: 'path',
                description: 'Fund id to add donation to',
                required: true,
                type: 'number'
        } */
    /*  #swagger.requestBody = {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref : '#/definitions/donation' }  
                    }
                }
            
        } */
    try {
        const body = req.body as
            | { username?: string; userId?: number; amount: number; currency?: string; accountant?: string; postChat?: string }
            | undefined;
        const fundId = Number(req.params.id);

        if (!body || (!body.username && !body.userId) || !body.amount)
            return void res.status(400).send({ error: "Missing body parameters" });
        if (isNaN(fundId)) return void res.status(400).send({ error: "Invalid fund id" });

        const fund = FundsRepository.getFundById(fundId);

        if (!fund) return void res.status(400).send({ error: "Fund not found" });

        const user = body.userId
            ? UsersRepository.getUserByUserId(body.userId)
            : body.username
              ? UsersRepository.getUserByName(body.username)
              : undefined;

        if (!user) return void res.status(400).send({ error: "User not found" });

        const accountant = body.accountant ? UsersRepository.getUserByName(body.accountant) : SERVICE_USERS.terminal;

        if (!accountant) return void res.status(400).send({ error: "Accountant user not found" });

        const donationResult = await donateToFund(fund.name, body.amount, body.currency ?? "AMD", user, accountant);
        const requestIp = getRequestIp(req) ?? "unknown";

        const alertMessage = `New donation added via API:\nIP: ${requestIp} \nUser: ${user.username ?? user.first_name} (${user.userid})\nFund: ${fund.name}\nAmount: ${donationResult.amount} ${donationResult.currency}`;
        logger.info(alertMessage);
        bot.sendAlert(`🗳 ${alertMessage}`).catch(e => logger.error(`Failed to send donation alert: ${(e as Error).message}`));

        const bodyChatId = Number(body.postChat);
        const parsedChatId = isNaN(bodyChatId) ? botConfig.chats[body.postChat as keyof typeof botConfig.chats] : bodyChatId;

        if (parsedChatId) {
            await FundsController.sendGratitude(
                bot,
                {
                    message_id: 0,
                    from: {
                        id: SERVICE_USERS.terminal.userid,
                        is_bot: true,
                        username: "Terminal",
                        first_name: "Terminal",
                    },
                    chat: { id: parsedChatId, type: "group" },
                    date: new Date().getTime(),
                },
                donationResult,
                user,
                fund.name
            );
        }

        res.json({ message: "Success" });
    } catch (error) {
        logger.error(`Failed to add donation: ${(error as Error).message}`);

        res.status(500).send({ error });
    }
});

export default apiRouter;
