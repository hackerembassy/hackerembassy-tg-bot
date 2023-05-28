const express = require("express");
const cors = require("cors");
const logger = require("./services/logger");
const bodyParser = require('body-parser');
const config = require("config");

const TextGenerators = require("./services/textGenerators");
const StatusRepository = require("./repositories/statusRepository");
const FundsRepository = require("./repositories/fundsRepository");
const UsersRepository = require("./repositories/usersRepository");
const Commands = require("./resources/commands");

const apiConfig = config.get("api");
const app = express();
const port = apiConfig.port;

// Middleware
function logError(err, req, res, next) {
  logger.error({err, req, res});
  next();
}

function tokenSecured(req, res, next) {
  if (!req.body?.token || req.body.token !== process.env["UNLOCKKEY"]) {
    logger.info(`Got request with invalid token`);
    res.status(401).send({message: "Invalid token"});
    return;
  }

  next();
}

app.use(cors());
app.use(bodyParser.json()); 
app.use(logError);

// Routes
app.get("/commands", (_, res) => {
  res.send(Commands.ApiCommandsList);
});

app.get("/status", (_, res) => {
  let state = StatusRepository.getSpaceLastState();
  let content = `🔐 Статус спейса неопределен`;

  if (state) {
    let inside = StatusRepository.getPeopleInside();
    let going = StatusRepository.getPeopleGoing();
    content = TextGenerators.getStatusMessage(state, inside, going, true);
  }

  res.send(content);
});

app.get("/api/status", (_, res) => {
  let status = StatusRepository.getSpaceLastState();

  if (!status) {
    res.json({
      error: "Status is not defined",
    });
    return;
  }

  let inside = StatusRepository.getPeopleInside().map(p=> {
    return {
      username: p.username,
      dateChanged: p.date,
    }
  });
  let planningToGo = StatusRepository.getPeopleGoing().map(p=> {
    return {
      username: p.username,
      dateChanged: p.date,
    }
  });

  res.json({
    open: status.open == true,
    dateChanged:  status.date,
    changedBy: status.changedBy,
    inside,
    planningToGo
  });
});

app.get("/api/inside", (_, res) => {
  let inside = StatusRepository.getPeopleInside();
  res.json(inside);
});

app.get("/api/insidecount", (_, res) => {
  try{
    let inside = StatusRepository.getPeopleInside();
    res.status(200).send(inside.length.toString());
  } catch{
    res.status(500).send("-1");
  }
});

app.post("/api/open", tokenSecured, (_, res) => {
  StatusRepository.pushSpaceState({
    open: true,
    date: new Date(),
    changedby: "api",
  });

  return  res.send({message: "Success"});
});

app.post("/api/close", tokenSecured, (_, res) => {
  StatusRepository.pushSpaceState({
    open: false,
    date: new Date(),
    changedby: "api",
  });

  StatusRepository.evictPeople();

  return  res.send({message: "Success"});
});

app.get("/join", (_, res) => {
  let message = TextGenerators.getJoinText(true);
  res.send(message);
});

app.get("/funds", async (_, res) => {
  let funds = FundsRepository.getfunds().filter((p) => p.status === "open");
  let donations = FundsRepository.getDonations();
  let list = await TextGenerators.createFundList(funds, donations, {showAdmin:false, isApi:true});

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