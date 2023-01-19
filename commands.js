const GeneralCommandsList = `
Общие команды:
/help - Помощь
/about - О спейсе
/join - Как присоединиться к нам
/donate - Как задонатить
/location - Как нас найти
/status - Статус спейса и кто отметился внутри
/in - Отметиться находящимся в спейсе
/out - Отметиться ушедшим из спейса
/funds - Наши открытые сборы
/fundsAll - Все сборы
\`/fund fund_name\` - Вывести сбор по имени
`;

const MemberCommandsList = `
Команды резидентов:
/open - Открыть спейс
/close - Закрыть спейс
/clear n - Удалить последние n ответов бота из чата (можно без параметра для удаления одного последнего ответа)
\`/inForce telegram_username\` - Отметить другого юзера пришедшим в спейс
\`/outForce telegram_username\` - Отметить другого юзера ушедшим из спейса
`;

const AdminCommandsList = ` 
Команды админов:
/getUsers
\`/addUser telegram_username as user_role1|user_role2|user_role3\`
\`/removeUser telegram_username\`
\`/updateRoles of telegram_username to user_role1|user_role2|user_role3\`

\\* Roles: admin, accountant, member, default
`;

const AccountantCommandsList = `
Команды бухгалтера:
\`/addFund Fund_Name with target goal_value currency_code\`
\`/updateFund Fund_Name with target goal_value currency_code as New_Name\`
\`/exportFund fund_name\`
\`/exportDonut fund_name\`
\`/closeFund fund_name\`
\`/changeFundStatus of fund_name to status_name\`
\`/removeFund fund_name\`
\`/addDonation donation_value currency_code from telegram_username to fund_name\`
\`/removeDonation donation_id\`

\\* Statuses: open, closed, postponed
\\* CAREFULL, /removeFund will wipe all its donations, use /closeFund instead
`;

const GlobalModifiers = `
Эти модификаторы можно добавить в конце любой команды:
\`-silent\` - Команда выполнится без вывода ответа
\`-nomention\` - Ник пользователя будет выведен без @ и он не получит уведомление о упоминании
\`-nocommands\` - Вспомогательные команды не будут выводиться для админа и бухгалтера по умолчанию
`

const ApiCommandsList = `
-status - Статус спейса и кто отметился внутри
-join - Как присоединиться к нам
-donate - Как задонатить
-funds - Наши открытые сборы
`;

module.exports = {GeneralCommandsList, MemberCommandsList, AdminCommandsList, AccountantCommandsList, ApiCommandsList, GlobalModifiers}