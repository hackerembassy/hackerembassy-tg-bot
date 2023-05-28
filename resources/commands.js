const GeneralCommandsList = `
Общие команды:
/start - Панель управления бота
/help - Помощь
/about - О спейсе и боте
/join - Как присоединиться к нам
/donate - Как задонатить
/location - Как нас найти
/status (s) - Статус спейса и кто отметился внутри
/in - Отметиться находящимся в спейсе
/out - Отметиться ушедшим из спейса
/going (g) - Планирую сегодня в спейс
/notgoing (ng) - Больше не планирую сегодня в спейс
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
/setmac - Управление своим MAC адресом
/autoinside - Настроить автоматический вход и выход из спейса
/issue issue_text - Полностью анонимно сообщить о какой-либо проблеме в спейсе (чего-то не хватает, что-то не работает, кто-то делает что-то очень неправильное в спейсе). Резиденты обязательно её рассмотрят и постараются решить.

Мем команды:
/randomcat
/randomdog
/randomcab
`;

const MemberCommandsList = `
Команды резидентов:
/open (o) - Открыть спейс
/close (c) - Закрыть спейс
/superstatus (ss) - Статус и изображения со всех камер
/firstfloor (ff) - Глянуть камеру первого этажа
/secondfloor (sf) - Глянуть камеру второго этажа
/doorcam (dc) - Глянуть камеру снаружи
/doorbell (db) - Позвонить в дверной звонок
/unlock (u) - Открыть дверь (только если роутер видит твой мак, зареганный в /setmac)
/clear n - Удалить последние n ответов бота из чата (можно без параметра для удаления одного последнего ответа)
#\`/inforce telegram_username#\` - Отметить другого юзера пришедшим в спейс
#\`/outforce telegram_username#\` - Отметить другого юзера ушедшим из спейса
`;

const AdminCommandsList = ` 
Команды админов:
/getusers
#\`/adduser telegram_username as user_role1|user_role2|user_role3#\`
#\`/removeuser telegram_username#\`
#\`/updateroles of telegram_username to user_role1|user_role2|user_role3#\`
/forcebirthdaywishes
#\`/forward some_text#\`
/getlogs

\\* Roles: admin, accountant, member, default
`;

const AccountantCommandsList = `
Команды бухгалтера:
#\`/costs donation_value currency_code from telegram_username#\` - Задонатить в последний актуальный сбор на аренду
#\`/addfund Fund_Name with target goal_value currency_code#\` - Добавить сбор
#\`/updatefund Fund_Name with target goal_value currency_code as New_Name#\` - Обновить параметры сбора
#\`/exportfund fund_name#\` - Экспортировать донаты сбора как CSV
#\`/exportfonut fund_name#\` - Экспортировать донаты сбора как диаграмму
#\`/closefund fund_name#\` - Изменить статус сбора на закрытый
#\`/changefundftatus of fund_name to status_name#\` - Изменить статус сбора
#\`/removefund fund_name#\` - Удалить сбор (не надо)
#\`/adddonation donation_value currency_code from telegram_username to fund_name#\`
#\`/changedonation donation_id to donation_value currency_code#\`
#\`/removedonation donation_id#\` - Удалить донат
#\`/transferdonation donation_id to username#\` - Передать донат другому бухгалтеру

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