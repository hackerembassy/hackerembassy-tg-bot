const Commands = require("../resources/commands");
const UsersRepository = require("../repositories/usersRepository");

function hasRole(username, ...roles) {
  let userRoles = UsersRepository.getUser(username)?.roles;

  if (!userRoles) return false;

  let intersection = userRoles.filter((r) => roles.includes(r));

  return intersection.length > 0;
}

function getRoles(user) {
  if (user?.roles) return user.roles;
  return UsersRepository.getUser(user)?.roles ?? [];
}

function isMember(user){
  let userRoles = user?.roles ? user?.roles : UsersRepository.getUser(user)?.roles;
  return userRoles.includes("member");
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

module.exports = { getAvailableCommands, hasRole, isMember, getRoles };