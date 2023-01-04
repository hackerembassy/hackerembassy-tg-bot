Бот для решения различных спейсовских задач. Пока реализованы:
- Базовое управление проектами и донатами
- Открытие и закрытие спейса, отмечание прихода ухода участников
- Базовое управление пользователями и ролями
- Информация о спейсе и приеме донатов

Пока он хостится на личном VPS @tectonick. Обращайтесь по всем вопросам деплоя или токена тестового бота. 
Так же можете создать своего тестового бота с помощью BotFather в телеге.

TODO
- Поддержка сессий и пошагового взаимодействия для команд
- Поддержка заготовленных ответов в виде кнопок
- Взаимодействие с сайтом спейса
- Контейнеризация и скрипты деплоя

Для локальной разработки:
1. npm install
2. Скопируйте в папке data файл sample.db и назовите его data.db (или npm run reset в bash)
3. Установите env переменную (можно создать файл .env со следующим содержимым)
        HACKERBOTTOKEN="Токен тестового бота"
4. npm run dev
