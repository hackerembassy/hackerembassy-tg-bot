const express = require("express");
const cors = require("cors");
const logger = require("./services/logger");
const bodyParser = require('body-parser');
const config = require("config");
const botConfig = config.get("bot");
const bot = require("./bot/bot");

const TextGenerators = require("./services/textGenerators");
const StatusRepository = require("./repositories/statusRepository");
const FundsRepository = require("./repositories/fundsRepository");
const UsersRepository = require("./repositories/usersRepository");
const Commands = require("./resources/commands");

const apiConfig = config.get("api");
const app = express();
const port = apiConfig.port;

app.use(cors());

app.use(bodyParser.json()); 

function logError(err, req, res, next) {
  logger.error({err, req, res});
  next();
}

app.use(logError);

app.get("/commands", (_, res) => {
  res.send(Commands.ApiCommandsList);
});

app.post("/doorbell", (req, res) => {
  if (!req.body?.token || req.body.token !== process.env["UNLOCKKEY"]) {
    logger.info(`Got doorbell with invalid token`);
    res.send({message: "Invalid token"});
    return;
  }

  logger.info(`Got doorbell`);
  let inside = StatusRepository.getPeopleInside();  
  if (!inside || inside.length === 0){
    logger.info(`No one inside. Notified members.`);
    bot.sendMessage(botConfig.chats.key, "🔔 Кто-то позвонил в дверной звонок, а внутри никого.")
  }

  res.send({message: "Success"});
});

app.get("/status", (_, res) => {
  let state = StatusRepository.getSpaceLastState();
  let content = `🔐 Статус спейса неопределен`;

  if (state) {
    let inside = StatusRepository.getPeopleInside();
    content = TextGenerators.getStatusMessage(state, inside, true);
  }

  res.send(content);
});

app.get("/join", (_, res) => {
  let message = TextGenerators.getJoinText(true);
  res.send(message);
});

app.get("/funds", async (_, res) => {
  let funds = FundsRepository.getfunds().filter((p) => p.status === "open");
  let donations = FundsRepository.getDonations();
  let list = await TextGenerators.createFundList(funds, donations, false, true);

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