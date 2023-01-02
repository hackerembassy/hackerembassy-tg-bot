const GeneralCommandsList = `
Общие команды:
/help - Помощь
/funds - Наши открытые сборы
/fundsAll - Все сборы
/status - Статус спейса и кто отметился внутри
/in - Отметиться находящимся в спейсе
/out - Отметиться ушедшим из спейса
`;

const MemberCommandsList = `
Команды резидентов:
/open - Открыть спейс
/close - Закрыть спейс
`;

const AdminCommandsList = ` 
Команды админов:
/addUser telegram_username as user_role1|user_role2|user_role3
/removeUser telegram_username
/updateRoles of telegram_username to user_role1|user_role2|user_role3
/getUsers

* Roles: admin, accountant, member, default
`;

const AccountantCommandsList = `
Команды бухгалтера:
/addFund fund_name with target value_in_AMD
/closeFund fund_name
/changeFundStatus of fund_name to status_name - 
/removeFund fund_name
/addDonation value_in_AMD from telegram_username to fund_name
/removeDonation donation_id

* Statuses: open, closed, postponed
* CAREFULL, /removeFund will wipe all its donations
`;

module.exports = {GeneralCommandsList, MemberCommandsList, AdminCommandsList, AccountantCommandsList}