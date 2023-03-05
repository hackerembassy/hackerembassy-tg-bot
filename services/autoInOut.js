const StatusRepository = require("../repositories/statusRepository");
const UsersRepository = require("../repositories/usersRepository");
const fetch = require("node-fetch");
const config = require("config");
const botConfig = config.get("bot");
const embassyApiConfig = config.get("embassy-api");
const logger = require("./logger");

async function autoinout(isIn){
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let devices = await (await fetch(`${embassyApiConfig.host}:${embassyApiConfig.port}/devices`, { signal: controller.signal }))?.json();
      clearTimeout(timeoutId);
  
      let insideusernames = StatusRepository.getPeopleInside()?.map(us=>us.username);
      let autousers = UsersRepository.getUsers()?.filter(u => u.mac);
      let selectedautousers = isIn ? autousers.filter(u=>!insideusernames.includes(u.username)) : autousers.filter(u=>insideusernames.includes(u.username));
  
      for (const user of selectedautousers) {
        if (isIn ? devices.includes(user.mac) : !devices.includes(user.mac)){
          StatusRepository.pushPeopleState({
            status: isIn ? StatusRepository.UserStatusType.Inside : StatusRepository.UserStatusType.Outside,
            date: new Date(),
            username: user.username,
            type: StatusRepository.ChangeType.Auto
          });
  
          logger.info(`Юзер ${user.username} автоматически ${isIn ? "пришел" : "ушел"}`);
        }
      }
    }
    catch(error) {
      logger.error(error);
    }
  }
  
  setInterval(()=>autoinout(true), botConfig.timeouts.in);
  setInterval(()=>autoinout(false), botConfig.timeouts.out);