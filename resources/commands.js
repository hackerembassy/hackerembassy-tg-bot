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
/printer - О нашем 3D принтере
/printerstatus - Статус 3D принтера
/getresidents - Наши резиденты, можно к ним обратиться по любым спейсовским вопросам
/funds - Наши открытые сборы
/fundsall - Все сборы
#\`/fund fund_name#\` - Вывести сбор по имени
/birthdays - Кто празднует днюху в этом месяце
/needs - Посмотреть, что просили купить в спейс по дороге
#\`/buy item_name#\` - Попросить купить что-нибудь в спейс по дороге (бумага, чай, и.т.п)
#\`/bought item_name#\` - Отметить что-то купленным из needs
/autoinside - Настроить автоматический вход и выход из спейса
`;

const MemberCommandsList = `
Команды резидентов:
/open - Открыть спейс
/close - Закрыть спейс
/webcam - Глянуть камеру из спейса
/clear n - Удалить последние n ответов бота из чата (можно без параметра для удаления одного последнего ответа)
#\`/inForce telegram_username#\` - Отметить другого юзера пришедшим в спейс
#\`/outForce telegram_username#\` - Отметить другого юзера ушедшим из спейса
`;

const AdminCommandsList = ` 
Команды админов:
/getusers
#\`/adduser telegram_username as user_role1|user_role2|user_role3#\`
#\`/removeuser telegram_username#\`
#\`/updateroles of telegram_username to user_role1|user_role2|user_role3#\`
/forcebirthdaywishes
#\`/forward some_text#\`
/getlog

\\* Roles: admin, accountant, member, default
`;

const AccountantCommandsList = `
Команды бухгалтера:
#\`/costs donation_value currency_code from telegram_username#\` - Задонатить в последний актуальный сбор на аренду
#\`/addFund Fund_Name with target goal_value currency_code#\` - Добавить сбор
#\`/updateFund Fund_Name with target goal_value currency_code as New_Name#\` - Обновить параметры сбора
#\`/exportFund fund_name#\` - Экспортировать донаты сбора как CSV
#\`/exportDonut fund_name#\` - Экспортировать донаты сбора как диаграмму
#\`/closeFund fund_name#\` - Изменить статус сбора на закрытый
#\`/changeFundStatus of fund_name to status_name#\` - Изменить статус сбора
#\`/removeFund fund_name#\` - Удалить сбор (не надо)
#\`/addDonation donation_value currency_code from telegram_username to fund_name#\`
#\`/removeDonation donation_id#\` - Удалить донат
#\`/transferDonation donation_id to username#\` - Передать донат другому бухгалтеру

\\* Statuses: open, closed, postponed
\\* CAREFULL, /removeFund will wipe all its donations, use /closeFund instead
`;

const GlobalModifiers = `
Эти модификаторы можно добавить в конце любой команды:
#\`-silent#\` - Команда выполнится без вывода ответа
#\`-mention#\` - Пользователь будет упомянут с уведомлением
#\`-admin#\` - Вспомогательные команды выведутся для админа и бухгалтера и в публичном чате
`

const ApiCommandsList = `
-status - Статус спейса и кто отметился внутри
-join - Как присоединиться к нам
-donate - Как задонатить
-funds - Наши открытые сборы
`;

module.exports = {GeneralCommandsList, MemberCommandsList, AdminCommandsList, AccountantCommandsList, ApiCommandsList, GlobalModifiers}