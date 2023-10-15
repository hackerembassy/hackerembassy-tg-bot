import { json } from "body-parser";
import config from "config";
import cors from "cors";
import express from "express";

import StatusHandlers from "./bot/handlers/status";
import { BotApiConfig, EmbassyApiConfig } from "./config/schema";
import FundsRepository from "./repositories/fundsRepository";
import StatusRepository from "./repositories/statusRepository";
import UsersRepository from "./repositories/usersRepository";
import { ApiCommandsList } from "./resources/commands";
import logger from "./services/logger";
import { closeSpace, filterPeopleGoing, filterPeopleInside, findRecentStates, openSpace } from "./services/statusHelper";
import * as TextGenerators from "./services/textGenerators";
import { stripCustomMarkup } from "./utils/common";
import { createErrorMiddleware, createTokenSecuredMiddleware } from "./utils/middleware";
import { fetchWithTimeout } from "./utils/network";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const apiConfig = config.get<BotApiConfig>("api");

const app = express();
const port = apiConfig.port;
const tokenHassSecured = createTokenSecuredMiddleware(logger, process.env["UNLOCKKEY"]);
const tokenGuestSecured = createTokenSecuredMiddleware(logger, process.env["GUESTKEY"]);

app.use(cors());
app.use(json());
app.use(createErrorMiddleware(logger));

// Routes
app.get("/text/commands", (_, res) => {
    res.send(ApiCommandsList);
});

app.get("/text/status", async (_, res) => {
    const state = StatusRepository.getSpaceLastState();
    let content = `🔐 Статус спейса неопределен`;

    if (state) {
        const allUserStates = findRecentStates(StatusRepository.getAllUserStates() ?? []);
        const inside = allUserStates.filter(filterPeopleInside);
        const going = allUserStates.filter(filterPeopleGoing);
        const climateInfo = await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/climate`)).json();

        content = TextGenerators.getStatusMessage(state, inside, going, climateInfo, { mention: true }, false, true);
    }

    res.send(stripCustomMarkup(content));
});

app.get("/api/status", (_, res) => {
    const status = StatusRepository.getSpaceLastState();

    if (!status) {
        res.json({
            error: "Status is not defined",
        });
        return;
    }

    const recentUserStates = findRecentStates(StatusRepository.getAllUserStates() ?? []);

    const inside = recentUserStates.filter(filterPeopleInside).map(p => {
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

app.get("/api/inside", (_, res) => {
    const inside = findRecentStates(StatusRepository.getAllUserStates() ?? []).filter(filterPeopleInside);
    res.json(inside);
});

app.get("/api/insidecount", (_, res) => {
    try {
        const inside = findRecentStates(StatusRepository.getAllUserStates() ?? []).filter(filterPeopleInside);
        res.status(200).send(inside.length.toString());
    } catch {
        res.status(500).send("-1");
    }
});

app.post("/api/setgoing", tokenGuestSecured, (req, res) => {
    try {
        if (typeof req.body.username !== "string" || typeof req.body.isgoing !== "boolean") {
            res.status(400).send({ error: "Missing or incorrect parameters" });
            return;
        }

        StatusHandlers.setGoingState(
            req.body.username as string,
            req.body.isgoing as boolean,
            req.body.message as string | undefined
        );

        res.json({ message: "Success" });
    } catch (error) {
        res.status(500).send({ error });
    }
});

app.post("/api/open", tokenHassSecured, (_, res) => {
    openSpace("hass");

    return res.send({ message: "Success" });
});

app.post("/api/close", tokenHassSecured, (_, res) => {
    closeSpace("hass", { evict: true });

    return res.send({ message: "Success" });
});

app.get("/text/join", (_, res) => {
    const message = TextGenerators.getJoinText(true);
    res.send(message);
});

app.get("/text/events", (_, res) => {
    const message = TextGenerators.getEventsText(true);
    res.send(message);
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

app.listen(port);

logger.info(`Bot Api is ready to accept requests`);
