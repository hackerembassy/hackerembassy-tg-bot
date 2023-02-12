const express = require("express");
const cors = require("cors");
const config = require("config");

const TextGenerators = require("./services/textGenerators");
const StatusRepository = require("./repositories/statusRepository");
const FundsRepository = require("./repositories/fundsRepository");
const UsersRepository = require("./repositories/usersRepository");
const Commands = require("./resources/commands");

const apiConfig = config.get("api");
const app = express();
const port = apiConfig.port;

app.use(cors());

app.get("/commands", (_, res) => {
  res.send(Commands.ApiCommandsList);
});

app.get("/status", (_, res) => {
  let state = StatusRepository.getSpaceLastState();
  let content = `🔐 Статус спейса неопределен`;

  if (state) {
    let inside = StatusRepository.getPeopleInside();
    content = TextGenerators.getStatusMessage(state, inside);
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
  let list = await TextGenerators.createFundList(funds, donations, false);

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
