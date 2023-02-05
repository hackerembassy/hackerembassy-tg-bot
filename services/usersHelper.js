const Commands = require("../resources/commands");
const UsersRepository = require("../repositories/usersRepository");

function hasRole(username, ...roles) {
  let userRoles = UsersRepository.getUser(username)?.roles;

  if (!userRoles) return false;

  let intersection = userRoles.filter((r) => roles.includes(r));

  return intersection.length > 0;
}

function getAvailableCommands(username) {
  let availableCommands = Commands.GeneralCommandsList;
  let userRoles = UsersRepository.getUser(username)?.roles;

  if (!userRoles) return availableCommands;

  if (userRoles.includes("member"))
    availableCommands += Commands.MemberCommandsList;
  if (userRoles.includes("admin"))
    availableCommands += Commands.AdminCommandsList;
  if (userRoles.includes("accountant"))
    availableCommands += Commands.AccountantCommandsList;

  return availableCommands;
}

module.exports = { getAvailableCommands, hasRole };
