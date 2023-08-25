# Hacker embassy бот
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=hackerembassy_hackerembassy-tg-bot&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=hackerembassy_hackerembassy-tg-bot)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=hackerembassy_hackerembassy-tg-bot&metric=bugs)](https://sonarcloud.io/summary/new_code?id=hackerembassy_hackerembassy-tg-bot)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=hackerembassy_hackerembassy-tg-bot&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=hackerembassy_hackerembassy-tg-bot)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=hackerembassy_hackerembassy-tg-bot&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=hackerembassy_hackerembassy-tg-bot)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=hackerembassy_hackerembassy-tg-bot&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=hackerembassy_hackerembassy-tg-bot)  
## About
Бот для решения различных спейсовских задач. Пока реализованы:
- Информация о спейсе, резиденстве, местоположении и приеме донатов
- Открытие и закрытие спейса, отмечание прихода ухода участников, отмечание кто собирается в спейс
- Управление сборами денег и донатами с генерацией csv и диаграмм, с конвертацией валют фиатов и крипты
- Управление вещами, которые нужно купить в спейс по дороге
- Управление пользователями и ролями
- Получение статуса 3d принтера (фото печатающейся модели, фото с камеры принтера, процент завершения печати, оставшееся время, потраченные расходники, температуры)
- Доступ к камерам наблюдения первого этажа и двери
- Открытие двери и включение дверного замка с уведомлением в чат и фото с камеры, если звонят тогда, когда в спейсе никого нет
- API некоторых команд для сайта спейса
- Глобальные модификаторы команд
- Кнопки быстрых inline-ответов
- Учет автоматического входа и ухода участников из спейса через wifi сеть
- Учет дней рождения и автопоздравление от бота в нужный день
- Уведомление резидентов об оплате коммуналки и интернета спейса в нужные дни
- Мем команды с рандомными фотками котиков, пёсиков и Каба

Для хранения данных используется база sqlite в файле ./data/db/data.db
Тестовый файл с верной схемой ./data/sample.db
Для редактирования базы вручную рекомендую https://sqlitebrowser.org/

Роли пользователей: 
- admin - управляет пользователями
- accountant - управляет донатами и сборами
- member - резидент спейса, может открывать и закрывать спейс
- default - обычный гость, в базе данных присутствие необязательно

## Hosting
Сам бот хостится на VPS с адресом gateway.hackerembassy.site.   
Сервис embassy-api хостится в спейсе компе le-fail у окна на первом этаже и обеспечивает связь с внутренней инфраструктурой спейса (3d принтер, роутер, камеры, звонок).  
По всем вопросам деплоя или токена тестового бота обращайтесь к @tectonick и @Himura2la. При мерже в main настроена CI/CD, по ней можно обращаться к @Himura2la.  
Так же можете создать своего тестового бота с помощью BotFather в телеге.  

## Dependencies
Node 18+
Все основные зависимости в облаке и внутреннем сервисе устанавливаются с помощью npm i
Для конвертации потока дверной камеры в jpg на сервисе бота нужно установить ffmpeg и прописать его в PATH.

## Local deployment:
1. Установите nodejs версии 18+
2. Перейдите в папку склонированного репозитория
3. Установите зависимости с командой  
        npm install
4. Подготовьте бот к первому запуску (если у вас винда, то повторите действия скрипта ./deploy/dev/init.sh вручную)  
        npm run init
5. Установите env переменные (можно создать файл .env со следующим содержимым)  
        HACKERBOTTOKEN="Токен тестового бота из бота https://t.me/BotFather"
6. Запустите бота в режиме автоматического перезапуска при изменении source кода  
        npm run dev - только бот  
        npm run dev-service - только сервис  
        npm run dev-both - бот и сервис одновременно 

## Main files
bot/HackerEmbassyBot.js - Класс бота либы с расширениями для дополнительной функциональности  
bot/bot-instance.js - инициализация синглтона для работы с ботом  
bot/bot-routes.js - мапинги текстовых команд на их обработчики  
bot/bot-automatic.js - настройка действий, которые бот выполняет автоматически по таймеру
bot/handlers/*.js - обработчики команд пользователей  

data/sample.db - база темплейт для обновления схемы  
data/db/data.db - основная база данных sqlite (можно скопировать sample.db и переименовать)  
data/db.js - сервис для работы с базой  

repositories - репозитории поверх сервиса работы с базой  
resources - всякие доп ресурсы, картинки, тексты, и.т.п.  
service - модули с функционалом для различных нужд (общение по mqtt, получение медиа, генерация текста, экспортаб логгирования и.т.п.)  
utils - наборы общих реиспользуемых утилит  
deploy - вспомогательные файлы для развертывания бота и сервиса  

app.js - стартовый файл бота  
botApi.js - файл node express сервиса, запускаемого ботом, для общения с ним через API  
embassyApi.js - стартовый файл внутреннего сервиса спейса  

## Environment variables needed
HACKERBOTTOKEN  
LUCITOKEN  
UNLOCKKEY  
MQTTUSER  
MQTTPASSWORD  
WIFIUSER  
WIFIPASSWORD  
HASSTOKEN  

## Additional notes
Для взаимодействия между ботом и сервисом понадобится добавить папку sec с rsa ключами в файлах pub.key и priv.key.  
Также переменная UNLOCKKEY должна совпадать на боте и на сервисе.    
Проверьте настройки портов в папке config. Для локальной разработки лучше создать свою конфигурацию в файле config/local.json   