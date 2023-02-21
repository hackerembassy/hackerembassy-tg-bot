# Hacker embassy бот
## About
Бот для решения различных спейсовских задач. Пока реализованы:
- Информация о спейсе, резиденстве, местоположении и приеме донатов
- Открытие и закрытие спейса, отмечание прихода ухода участников
- Управление сборами денег и донатами с генерацией csv и диаграмм, с конвертацией валют фиатов и крипты
- Управление вещами, которые нужно купить в спейс по дороге
- Управление пользователями и ролями
- Получение статуса 3d принтера
- Доступ к камере наблюдения первого этажа
- API некоторых команд для сайта спейса
- Глобальные модификаторы команд
- Кнопки быстрых inline-ответов
- Учет автоматического входа и ухода участников из спейса через wifi сеть
- Учет дней рождения и автопоздравление от бота в нужный день

Для хранения данных используется база sqlite в файле ./data/data.db
Тестовый файл с верной схемой ./data/sample.db
Для редактирования базы вручную рекомендую https://sqlitebrowser.org/

Как reverse proxy для использования https и автоматического получения сертификатов используется веб-сервер Caddy. При разработке необязателен.

Роли пользователей: 
- admin - управляет пользователями
- accountant - управляет донатами и сборами
- member - резидент спейса, может открывать и закрывать спейс
- default - обычный гость, в базе данных присутствие необязательно.

## Hosting
Сам бот хостится на личном VPS @tectonick на nickkiselev.me.   
Сервис embassy-api хостится в спейсе на синем нетбукуе под 3d принтером и обеспечивает связь с внутренней инфраструктурой спейса (3d принтер, роутер, камера).  
По всем вопросам деплоя или токена тестового бота обращайтесь к @tectonick.   
Так же можете создать своего тестового бота с помощью BotFather в телеге.  

## TODO
- Взаимодействие с лазерным принтером
- Поддержка сессий и пошагового взаимодействия для команд
- Взаимодействие с home assistant
- Скрипты деплоя

## Local deployment:
1. Установите nodejs версии 18+
2. Перейдите в папку склонированного репозитория
3. Установите зависимости с командой  
        npm install
4. Подготовьте бот к первому запуску  
        npm run init
5. Установите env переменные (можно создать файл .env со следующим содержимым)  
        HACKERBOTTOKEN="Токен тестового бота из бота https://t.me/BotFather"
        BOTDEBUG="true"
6. Запустите бота в режиме автоматического перезапуска при изменении source кода  
        npm run dev

## Environment variables needed
HACKERBOTTOKEN
BOTDEBUG
LUCITOKEN
UNLOCKKEY
MQTTUSER
MQTTPASSWORD

## Additional notes
Для взаимодействия между ботом и сервисом понадобится добавить папку sec с rsa ключами в файлах pub.key и priv.key. 
Также переменная UNLOCKKEY должна совпадать на боте и на сервисе.  
Проверьте настройки портов в папке config. Для локальной разработки лучше создать свою конфигурацию в файле config/local.json  
Для старта сервиса вызывается node embassyApi.js  