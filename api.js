const express = require("express");
var cors = require('cors')
const TextGenerators = require("./services/textGenerators");
const StatusRepository = require("./repositories/statusRepository");

const app = express();
const port = 3000;

app.use(cors())

app.get("/status", (_, res) => {
  let state = StatusRepository.getSpaceLastState();
  let content = `🔐 Статус спейса неопределен`;

  if (state) {
    let inside = StatusRepository.getPeopleInside();
    content = TextGenerators.getStatusMessage(state, inside, "");
  }

  res.send(content);
});

app.listen(port);
