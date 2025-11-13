/* eslint-disable @typescript-eslint/no-unsafe-argument */
import config from "config";

import broadcast, { BroadcastEvents } from "@services/common/broadcast";

import { BotConfig } from "@config";

import UsersRepository from "@repositories/users";

import logger from "@services/common/logger";

import HackerEmbassyBot from "./core/classes/HackerEmbassyBot";
import AdminController from "./controllers/admin";
import BasicController from "./controllers/basic";
import BirthdayController from "./controllers/birthday";
import EmbassyController from "./controllers/embassy";
import FundsController from "./controllers/funds";
import MemeController from "./controllers/meme";
import NeedsController from "./controllers/needs";
import ServiceController from "./controllers/service";
import StatusController from "./controllers/status";
import SubscriptionsController from "./controllers/subscriptions";

const botConfig = config.get<BotConfig>("bot");

const defaultCommands = [
    { command: "start", description: "Панель управления" },
    { command: "lang", description: "Change bot language / Сменить язык бота" },
    { command: "help", description: "Помощь" },
    {
        command: "status",
        description: "Статус спейса и кто отметился внутри",
    },
    { command: "going", description: "Планирую сегодня в спейс" },
    { command: "in", description: "Отметиться находящимся в спейсе" },
    { command: "out", description: "Отметиться ушедшим из спейса" },
    { command: "hey", description: "Уведомить резидентов в спейсе, что их ждут в чате" },
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
    { command: "upcoming", description: "Ближайшие мероприятия в спейсе" },
    { command: "today", description: "Сегодняшние мероприятия в спейсе" },
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
    { command: "topics", description: "Топики для подписки на уведомления" },
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
    { command: "debt", description: "Сколько числится на тебе донатов" },
    { command: "scosts", description: "Показать сбор на аренду в этом месяце" },
    { command: "rcosts", description: "Кто из резидентов задонатил в аренду этом месяце" },
    { command: "rmonth", description: "Кто из резидентов задонатил в принципе в этом месяце" },
    {
        command: "needs",
        description: "Посмотреть, что просили купить в спейс по дороге",
    },
    { command: "anette", description: "Статус Anette" },
    { command: "stats", description: "Статистика по времени в спейсе" },
    { command: "topics", description: "Топики для подписки на уведомления" },
];

export async function setMenu(bot: HackerEmbassyBot): Promise<void> {
    try {
        await bot.setMyCommands(defaultCommands);
        await bot.setMyCommands(residentCommands, { scope: { type: "chat", chat_id: botConfig.chats.key } });

        if (process.env["NODE_ENV"] !== "production") return;

        const membersWithUserid = UsersRepository.getUsersByRole("member").filter(user => user.userid);

        if (membersWithUserid.length === 0) return;

        for (const member of membersWithUserid) {
            await bot.setMyCommands(residentCommands, { scope: { type: "chat", chat_id: member.userid } });
        }
    } catch (error) {
        logger.error(error);
    }
}

export function addControllers(bot: HackerEmbassyBot): void {
    bot.addController(AdminController);
    bot.addController(BasicController);
    bot.addController(BirthdayController);
    bot.addController(EmbassyController);
    bot.addController(FundsController);
    bot.addController(MemeController);
    bot.addController(NeedsController);
    bot.addController(ServiceController);
    bot.addController(StatusController);
    bot.addController(SubscriptionsController);
}

export function addSpecialRoutes(bot: HackerEmbassyBot): void {
    bot.addEventRoutes(EmbassyController.voiceInSpaceHandler, ServiceController.newMemberHandler);
}

export function addEventHandlers(bot: HackerEmbassyBot) {
    broadcast.addListener(BroadcastEvents.SpaceOpened, state => {
        StatusController.openedNotificationHandler(bot, state);
    });
    broadcast.addListener(BroadcastEvents.SpaceClosed, state => {
        StatusController.closedNotificationHandler(bot, state);
    });
    broadcast.addListener(BroadcastEvents.SpaceUnlocked, username => {
        EmbassyController.unlockedNotificationHandler(bot, username);
    });
}
