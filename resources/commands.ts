export const GeneralCommandsList: string = `
Инфа:
/start - Панель управления бота
/help - Помощь
/about - О спейсе и боте
/join - Как присоединиться к нам
/donate - Как задонатить
/location - Как нас найти
/getresidents - Наши резиденты, можно к ним обратиться по любым спейсовским вопросам

Мероприятия:
/events - О наших мероприятиях
/upcoming - Ближайшие мероприятия
/today - Сегодняшние мероприятия

Статус:
/status (s) - Статус спейса и кто отметился внутри (поддерживаются модификаторы -short, -live, -mention)
/in - Отметиться находящимся в спейсе
/out - Отметиться ушедшим из спейса
/going (g) - Планирую сегодня в спейс (можно после пробела указать когда, например #\`/going наверное около 20:00#\`)
/notgoing (ng) - Больше не планирую сегодня в спейс
/climate - Климат в спейсе

Принтеры:
/printers - О наших 3D принтерах
/anette - Статус 3D принтера Anette
/plumbus - Статус 3D принтера Plumbus

Сборы:
/funds (fs) - Наши открытые сборы
/funds (fs) - Наши открытые сборы
/costs (cs) - Показать сбор на аренду текущего месяца
/donut (dt)- Показать пончиковую диаграмму сбора на аренду текущего месяца
/fundsall (fsa) - Все сборы (в том числе архив)
#\`/fund fund_name#\` (f) - Вывести сбор по имени

Это другое:
/birthdays - Кто празднует днюху в этом месяце
/setmac - Управление своим MAC адресом
/autoinside - Настроить автоматический вход и выход из спейса
/issue issue_text - Полностью анонимно сообщить о какой-либо проблеме в спейсе (чего-то не хватает, что-то не работает, кто-то делает что-то очень неправильное в спейсе). Резиденты обязательно её рассмотрят и постараются решить.
#\`/sayinspace some_text#\` - Сказать что-нибудь на динамике в спейсе
#\`/announce some_text#\` - Объявить что-нибудь на динамике в спейсе

Надо купить в спейс:
/needs - Посмотреть, что просили купить в спейс по дороге
#\`/buy item_name#\` - Попросить купить что-нибудь в спейс по дороге (бумага, чай, и.т.п)
#\`/bought item_name#\` - Отметить что-то купленным из needs

Статистика:
/me - Твоя статистика донатов и посещений
/stats - Статистика по времени в спейсе (на основе отметок)
#\`/stats from YYYY-MM-DD to YYYY-MM-DD#\` - Статистика по времени в спейсе за выбранный период (можно указать только from или to)
/mystats - Статистика по моему времени в спейсе (на основе отметок)
/monthstats - Статистика по времени в спейсе за текущий месяц
/lastmonthstats - Статистика по времени в спейсе за прошлый месяц

Мем команды:
/randomcat
/randomdog
/randomcab
/randomcock
/rickroll
/rzd
`;

export const MemberCommandsList: string = `
Команды резидентов:
/open (o) - Открыть спейс
/close (c) - Закрыть спейс
/superstatus (ss) - Статус и изображения со всех камер
/firstfloor (ff) - Глянуть камеру первого этажа
/secondfloor (sf) - Глянуть камеру второго этажа
/doorcam (dc) - Глянуть камеру снаружи
/allcams (ac) - Глянуть все камеры
/doorbell (db) - Позвонить в дверной звонок
/unlock (u) - Открыть дверь (только если роутер видит твой мак, зареганный в /setmac)
/clear n - Удалить последние n ответов бота из чата (default n = 1)
/combine n - Соединить последние n ответов бота из чата в одно сообщение (default n = 2)
/setemoji - Поставить себе эмодзи в боте
/enableresidentmenu - Включить меню резидента в приватном чате с ботом
#\`/inforce telegram_username#\` - Отметить другого юзера пришедшим в спейс
#\`/outforce telegram_username#\` - Отметить другого юзера ушедшим из спейса
/evict - Очистить список отметившихся внутри
/residentsdonated - Кто из резидентов уже задонатил в этом месяце
/mideaon - Врубить кондей
/mideaoff - Вырубить кондей
/mideamode mode_name - Поменять режим кондея (mode_name = "cool" | "dry" | "fan_only" | "heat_cool" | "heat")
/mideatemp temp - Поменять целевую температуру кондея (temp = 16-28)
`;

export const AdminCommandsList: string = ` 
Команды админов:
/getusers
/getrestrictedusers
#\`/adduser telegram_username as user_role1|user_role2|user_role3#\`
#\`/removeuser telegram_username#\`
#\`/removeuserbyid telegram_user_id#\`
#\`/updateroles of telegram_username to user_role1|user_role2|user_role3#\`
#\`/restrict telegram_username#\`
#\`/unblock telegram_username#\`
/forcebirthdaywishes
#\`/forward some_text#\`
/getlogs
/getstate
/cleanstate
/stoplive

\\* Roles: admin, accountant, member, default
`;

export const AccountantCommandsList: string = `
Команды бухгалтера:
#\`/costs donation_value currency_code from telegram_username#\` (cs) - Задонатить в последний актуальный сбор на аренду
#\`/addfund Fund_Name with target goal_value currency_code#\` - Добавить сбор
#\`/updatefund Fund_Name with target goal_value currency_code as New_Name#\` - Обновить параметры сбора
#\`/exportfund fund_name#\` (csv) - Экспортировать донаты сбора как CSV
#\`/exportfonut fund_name#\` - Экспортировать донаты сбора как диаграмму
#\`/closefund fund_name#\` - Изменить статус сбора на закрытый
#\`/changefundftatus of fund_name to status_name#\` - Изменить статус сбора
#\`/removefund fund_name#\` - Удалить сбор (не надо)
#\`/adddonation donation_value currency_code from telegram_username to fund_name#\` (ad)
#\`/changedonation donation_id to donation_value currency_code#\`
#\`/removedonation donation_id#\` - Удалить донат
#\`/transferdonation donation_id to username#\` (td) - Передать донат другому бухгалтеру
#\`/tocab donation_id#\` - Передать донат Кабу
#\`/profile username#\` - Статистика посещений и донатов юзера

\\* Statuses: open, closed, postponed
\\* CAREFULL, /removeFund will wipe all its donations, use /closeFund instead
`;

export const GlobalModifiers: string = `
Эти модификаторы можно добавить в конце любой команды:
#\`-silent#\` - Команда выполнится без вывода ответа
#\`-mention#\` - Пользователь будет упомянут с уведомлением
#\`-static#\` - Вывод команды без кнопок
#\`-pin#\` - Вывод команды для закрепа (если поддерживается)
#\`-live#\` - Текст команды будет обновляться (если поддерживается)
#\`-admin#\` - Вспомогательные команды выведутся для админа и бухгалтера и в публичном чате
#\`-forward#\` - Сообщение будет переадресовано в главный чат
`;

export const ApiCommandsList: string = `
-status - Статус спейса и кто отметился внутри
-join - Как присоединиться к нам
-donate - Как задонатить
-funds - Наши открытые сборы
-events - Мероприятия у нас
`;
