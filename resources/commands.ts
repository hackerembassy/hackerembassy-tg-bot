export const GeneralCommandsList: string = `[Команды гостей]

Инфа:
/start - Панель управления бота
/help - Помощь
/about - О спейсе и боте
/join - Как присоединиться к нам
/donate - Как задонатить
/location - Как нас найти
/getresidents - Наши резиденты, можно к ним обратиться по любым спейсовским вопросам
/getsponsors - Наши спонсоры, которые регулярно донатят на нужды спейса

Мероприятия:
/events - О наших мероприятиях
/upcoming - Ближайшие мероприятия
/today - Сегодняшние мероприятия

Статус:
/status (s) - Статус спейса и кто отметился внутри (поддерживаются модификаторы -short, -live, -mention)
/in - Отметиться находящимся в спейсе (можно указать насколько, например #\`for 1h 30m#\` или #\`45m#\`)
/out - Отметиться ушедшим из спейса
/going (g) - Планирую сегодня в спейс (можно после пробела указать когда, например #\`/going наверное около 20:00#\`)
/notgoing (ng) - Больше не планирую сегодня в спейс
/hey - Уведомить резидентов в спейсе, что их ждут в чате
/climate - Климат в спейсе
/shouldgo - Спросить у ИИ идти ли в спейс

Принтеры:
/printers - О наших 3D принтерах
/anette - Статус 3D принтера Anette
/plumbus - Статус 3D принтера Plumbus

Сборы:
/funds (fs) - Наши открытые сборы
/costs (scs) - Показать сбор на аренду текущего месяца
/costsdonut (cdonut) - Показать пончиковую диаграмму сбора на аренду текущего месяца
/fundsall (fsa) - Все сборы (в том числе архив)
#\`/fund fund_name#\` (f) - Вывести сбор по имени
#\`/donut fund_name#\` (ed)- Показать пончиковую диаграмму сбора
#\`/donationsummary fund_name#\` - Сводка по донатам сбора на лед матрицу спейса

Это другое:
/birthdays - Кто празднует днюху в этом месяце
/topics - Уведомления, на которые можно подписаться
/mac - Управление своим MAC адресом
/autoinside - Настроить автоматический вход и выход из спейса
/issue issue_text - Полностью анонимно сообщить о какой-либо проблеме в спейсе (чего-то не хватает, что-то не работает, кто-то делает что-то очень неправильное в спейсе). Резиденты обязательно её рассмотрят и постараются решить.
/bug issue_text - Сообщить о какой-либо проблеме в боте. Юзернейм будет добавлен к сообщению автоматически, чтобы резиденты могли связаться с вами для уточнения деталей.
#\`/say some_text#\` - Сказать что-нибудь на динамике в спейсе
#\`/text some_text#\` - Вывести текст на лед матрице в спейсе
#\`/announce some_text#\` - Объявить что-нибудь на динамике в спейсе
#\`/play sounds_name_or_mp3_url#\` - Воспроизвести звук на динамике в спейсе
#\`/sounds#\` - Список загруженных звуков

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
/randomzhabka
/rickroll
/badumtss
/rzd

[END Команды гостей]
`;

export const MemberCommandsList: string = `
[Команды резидентов]

Управлением спейсом:
/open (o) - Открыть спейс
/close (c) - Закрыть спейс
/live - Закрепить короткий лайв статус
/doorbell (db) - Позвонить в дверной звонок
/unlock (u) - Открыть дверь (только если роутер видит твой мак, зареганный в /mac)
/inghost (ghost) - Войти в спейс отображаясь только для резидентов
#\`/inforce telegram_username#\` - Отметить другого юзера пришедшим в спейс
#\`/outforce telegram_username#\` - Отметить другого юзера ушедшим из спейса
/evict - Очистить список отметившихся внутри

Камеры:
/superstatus (ss) - Статус и изображения со всех камер
/downstairs (ff, cam1a) - Глянуть камеру первого этажа
/upstairs (sf, cam2) - Глянуть камеру второго этажа
/upstairs_ptz (sf2) - Глянуть подвижную камеру второго этажа
/kitchen (fridge) - Глянуть камеру на кухне
/balcony (balcam) - Глянуть камеру на балконе
/meeting_room (meetcam) - Глянуть камеру в переговорке
/facecontrol (face) - Глянуть камеру у входа
/gateway (gw) - Глянуть камеру в подъезде
/outdoors (doorcam) - Глянуть камеру снаружи
/allcams (ac) - Глянуть все камеры

Чаты:
/clear n - Удалить последние n ответов бота из чата (default n = 1)
/combine n (sq n) - Соединить последние n ответов бота из чата в одно сообщение (default n = 2)
/setemoji - Поставить себе эмодзи в боте
/enableresidentmenu - Включить меню резидента в приватном чате с ботом
/removebuttons (rb) - Убрать кнопки из сообщения бота (команду нужно отправлять как ответ)
/custom text - Создать кастомное сообщение с изображением и кнопками

Инфа:
/residentsdonated (rcosts) all|left|paid - Кто из резидентов уже задонатил в этом месяце
/historycosts year - График донатов резидентов на аренду (без указания года будет выбран текущий)

Кондиционер midea:
/mideaon - Врубить кондей
/mideaoff - Вырубить кондей
/mideamode mode_name - Поменять режим кондея (mode_name = "cool" | "dry" | "fan_only" | "heat_cool" | "heat")
/mideatemp temp - Поменять целевую температуру кондея (temp = 16-28)
/preheat - Заранее подогреть спейс

Кондиционер lg:
/lgon - Врубить кондей
/lgoff - Вырубить кондей
/lgmode mode_name - Поменять режим кондея (mode_name = "cool" | "dry" | "fan_only" | "heat_cool" | "heat")
/lgtemp temp - Поменять целевую температуру кондея (temp = 16-28)

Сеть спейса:
#\`/probe host#\` - Проверить доступность хоста
#\`/ping host#\` - Пропинговать хост
/gaming - Управление игровым сервером

Нейронки:
/txt2img, /img2img (sd) - Генерация текста по картинке с помощью StableDiffusion
/gpt (ask) - Спроси совета у нейросети

Эти резидентские модификаторы можно добавить в конце любой поддерживаемой команды:
#\`-secret#\` - Команда выведется с дополнительной информацией только для резидентов

[END Команды резидентов]
`;

export const AdminCommandsList: string = `
[Команды админов]

/getusers
/getrestrictedusers
/ban telegram_username_or_id
#\`/removeuser telegram_username#\`
#\`/removeuserbyid telegram_user_id#\`
#\`/updateroles of telegram_username to user_role1|user_role2|user_role3#\`
#\`/restrict telegram_username#\`
#\`/restrictbyid telegram_user_id#\`
#\`/unblock telegram_username#\`
#\`/unblockbyid telegram_user_id#\`
#\`/user telegram_username#\` - Получить информацию о юзере
#\`/setuser user_json#\` - Установить информацию о юзере

/forcebirthdaywishes
/getlogs
/getstate
/cleanstate
/stoplive
/setflag flag_name flag_value
/getflags
/target - Сменить чат для пересылки сообщений при -forward
/copy target_id_or_alias - Скопировать сообщение в выбранный чат (в reply на сообщение)
/linkchat - Привязать чат к текущему
/unlinkchat - Отвязать чат от текущего
/getlinkedchat - Получить привязанный чат
/detected - Получить список обнаруженных устройств в спейсе

\\* Roles: admin, accountant, member, trusted, restricted, banned, default

[END Команды админов]
`;

export const AccountantCommandsList: string = `
[Команды бухгалтеров]

Сборы:
#\`/costs donation_value currency_code from telegram_username#\` (cs) - Задонатить в последний актуальный сбор на аренду
#\`/addfund Fund_Name with target goal_value currency_code#\` - Добавить сбор
#\`/updatefund Fund_Name with target goal_value currency_code as New_Name#\` - Обновить параметры сбора
#\`/exportfund fund_name#\` (csv) - Экспортировать донаты сбора как CSV
#\`/exportdonut fund_name#\` - Экспортировать донаты сбора как диаграмму
#\`/closefund fund_name#\` - Изменить статус сбора на закрытый
#\`/changefundftatus of fund_name to status_name#\` - Изменить статус сбора
#\`/removefund fund_name#\` - Удалить сбор (не надо)

Донаты:
#\`/adddonation donation_value currency_code from telegram_username to fund_name#\` (ad)
#\`/changedonation donation_id to donation_value currency_code#\`
#\`/removedonation donation_id#\` - Удалить донат
#\`/transferdonation donation_id to username#\` (td) - Передать донат другому бухгалтеру
#\`/tocab donation_id#\` - Передать донат Кабу
#\`/tosafe donation_id#\` - Передать донат сейфу
#\`/tonick donation_id#\` - Передать донат Коле
#\`/tocaball fund_name#\` - Передать все свои донаты Кабу, опционально можно указать конкретный сбор
#\`/tosafeall fund_name#\` - Передать все свои донаты сейфу, опционально можно указать конкретный сбор
#\`/tonickall fund_name#\` - Передать все свои донаты Коле, опционально можно указать конкретный сбор
#\`/paid donation_id#\` - Отметить донат оплаченным по id (ушел на цель сбора)
#\`/profile username#\` - Статистика посещениий и донатов юзера
#\`/debt username#\` - Сколько донатов числится на юзере (без параметра - на тебе)

\\* Statuses: open, closed, postponed
\\* CAREFULL, /removeFund will wipe all its donations, use /closeFund instead

[END Команды бухгалтеров]
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

export const CommandsMap = {
    default: GeneralCommandsList,
    member: MemberCommandsList,
    admin: AdminCommandsList,
    accountant: AccountantCommandsList,
};
