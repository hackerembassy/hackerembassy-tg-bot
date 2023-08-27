const express = require("express");
const cors = require("cors");
const logger = require("./services/logger");
const bodyParser = require("body-parser");
const config = require("config");
const embassyApiConfig = config.get("embassy-api");

const TextGenerators = require("./services/textGenerators");
const StatusRepository = require("./repositories/statusRepository").default;
const FundsRepository = require("./repositories/fundsRepository").default;
const UsersRepository = require("./repositories/usersRepository").default;
const Commands = require("./resources/commands");
const { openSpace, closeSpace, filterPeopleInside, filterPeopleGoing, findRecentStates } = require("./services/statusHelper");
const { stripCustomMarkup } = require("./utils/common");
const { createErrorMiddleware } = require("./utils/middleware");
const { fetchWithTimeout } = require("./utils/network");

const apiConfig = config.get("api");
const app = express();
const port = apiConfig.port;

function tokenSecured(req, res, next) {
    if (!req.body?.token || req.body.token !== process.env["UNLOCKKEY"]) {
        logger.info(`Got request with invalid token`);
        res.status(401).send({ message: "Invalid token" });
        return;
    }

    next();
}

app.use(cors());
app.use(bodyParser.json());
app.use(createErrorMiddleware(logger));

// Routes
app.get("/commands", (_, res) => {
    res.send(Commands.ApiCommandsList);
});

app.get("/status", async (_, res) => {
    const state = StatusRepository.getSpaceLastState();
    let content = `🔐 Статус спейса неопределен`;

    if (state) {
        const allUserStates = findRecentStates(StatusRepository.getAllUserStates());
        const inside = allUserStates.filter(filterPeopleInside);
        const going = allUserStates.filter(filterPeopleGoing);
        const climateInfo = await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/climate`))?.json();

        content = TextGenerators.getStatusMessage(state, inside, going, climateInfo, { mention: true }, false, true);
    }

    res.send(stripCustomMarkup(content));
});

app.get("/api/status", (_, res) => {
    let status = StatusRepository.getSpaceLastState();

    if (!status) {
        res.json({
            error: "Status is not defined",
        });
        return;
    }

    const recentUserStates = findRecentStates(StatusRepository.getAllUserStates());

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
    let inside = findRecentStates(StatusRepository.getAllUserStates()).filter(filterPeopleInside);
    res.json(inside);
});

app.get("/api/insidecount", (_, res) => {
    try {
        let inside = findRecentStates(StatusRepository.getAllUserStates()).filter(filterPeopleInside);
        res.status(200).send(inside.length.toString());
    } catch {
        res.status(500).send("-1");
    }
});

app.post("/api/open", tokenSecured, (_, res) => {
    openSpace("hass");

    return res.send({ message: "Success" });
});

app.post("/api/close", tokenSecured, (_, res) => {
    closeSpace("hass", { evict: true });

    return res.send({ message: "Success" });
});

app.get("/join", (_, res) => {
    let message = TextGenerators.getJoinText(true);
    res.send(message);
});

app.get("/events", (_, res) => {
    let message = TextGenerators.getEventsText(true);
    res.send(message);
});

app.get("/funds", async (_, res) => {
    let funds = FundsRepository.getFunds().filter(p => p.status === "open");
    let donations = FundsRepository.getDonations();
    let list = await TextGenerators.createFundList(funds, donations, { showAdmin: false, isApi: true });

    let message = `⚒ Вот наши текущие сборы:

  ${list}💸 Чтобы узнать, как нам помочь - пиши donate`;

    res.send(message);
});

app.get("/donate", (_, res) => {
    let accountants = UsersRepository.getUsersByRole("accountant");
    let message = TextGenerators.getDonateText(accountants, true);
    res.send(message);
});

app.listen(port);

logger.info(`Bot Api is ready to accept requests`);
