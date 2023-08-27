import HackerEmbassyBot from "./HackerEmbassyBot";
import UsersRepository from "../repositories/usersRepository";
import logger from "../services/logger";

const botConfig = require("config").get("bot");

const defaultCommands = [
    { command: "start", description: "Панель управления" },
    { command: "help", description: "Помощь" },
    {
        command: "status",
        description: "Статус спейса и кто отметился внутри",
    },
    { command: "going", description: "Планирую сегодня в спейс" },
    { command: "in", description: "Отметиться находящимся в спейсе" },
    { command: "out", description: "Отметиться ушедшим из спейса" },
    { command: "open", description: "Открыть спейс" },
    { command: "close", description: "Закрыть спейс" },
    { command: "funds", description: "Наши открытые сборы" },
    {
        command: "birthdays",
        description: "Кто празднует днюху в этом месяце",
    },
    {
        command: "needs",
        description: "Посмотреть, что просили купить в спейс по дороге",
    },
    { command: "about", description: "О спейсе и боте" },
    { command: "join", description: "Как присоединиться к нам" },
    { command: "events", description: "Мероприятия в спейсе" },
    { command: "donate", description: "Как задонатить" },
    { command: "location", description: "Как нас найти" },
    { command: "printers", description: "О наших 3D принтерах" },
    {
        command: "autoinside",
        description: "Настроить автоматический вход и выход из спейса",
    },
    {
        command: "getresidents",
        description: "Наши резиденты, можно к ним обратиться по любым спейсовским вопросам",
    },
    { command: "stats", description: "Статистика по времени в спейсе" },
];

const residentCommands = [
    { command: "start", description: "Панель управления" },
    { command: "controlpanel", description: "Панель для резидентов" },
    {
        command: "ss",
        description: "Суперстатус",
    },
    { command: "going", description: "Планирую сегодня в спейс" },
    { command: "notgoing", description: "Не планирую сегодня в спейс" },
    { command: "open", description: "Открыть спейс" },
    { command: "close", description: "Закрыть спейс" },
    { command: "evict", description: "Очистить список отметившихся" },
    { command: "unlock", description: "Открыть дверь" },
    { command: "funds", description: "Наши открытые сборы" },
    { command: "fundsall", description: "Все сборы" },
    {
        command: "needs",
        description: "Посмотреть, что просили купить в спейс по дороге",
    },
    { command: "anette", description: "Статус Anette" },
    { command: "plumbus", description: "Статус Plumbus" },
    { command: "stats", description: "Статистика по времени в спейсе" },
];

export async function setMenu(bot: HackerEmbassyBot) {
    try {
        await bot.setMyCommands(defaultCommands);
        await bot.setMyCommands(residentCommands, { scope: { type: "chat", chat_id: botConfig.chats.key } });

        const membersWithUserid = UsersRepository.getUsersByRole("member").filter(user => user.userid);
        for (const member of membersWithUserid) {
            await bot.setMyCommands(residentCommands, { scope: { type: "chat", chat_id: member.userid } });
        }
    } catch (error) {
        logger.error(error);
    }
}
