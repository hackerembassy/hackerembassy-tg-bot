import config from "config";
import { Message } from "node-telegram-bot-api";
import { PingResponse } from "ping";

import { BotConfig, EmbassyApiConfig } from "../../config/schema";
import statusRepository from "../../repositories/statusRepository";
import usersRepository from "../../repositories/usersRepository";
import { ConditionerMode, ConditionerStatus, SpaceClimate } from "../../services/home";
import t from "../../services/localization";
import logger from "../../services/logger";
import { PrinterStatusResponse } from "../../services/printer3d";
import { filterPeopleInside, findRecentStates, hasDeviceInside } from "../../services/statusHelper";
import * as TextGenerators from "../../services/textGenerators";
import { hasRole } from "../../services/usersHelper";
import { sleep } from "../../utils/common";
import { fetchWithTimeout, filterFulfilled } from "../../utils/network";
import { encrypt } from "../../utils/security";
import HackerEmbassyBot, { BotCustomEvent, BotHandlers, BotMessageContextMode } from "../core/HackerEmbassyBot";
import { Flags } from "./service";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const botConfig = config.get<BotConfig>("bot");
export const embassyBase = `${embassyApiConfig.host}:${embassyApiConfig.port}`;

export default class EmbassyHandlers implements BotHandlers {
    static async unlockHandler(bot: HackerEmbassyBot, msg: Message) {
        if (!(await hasDeviceInside(msg.from?.username))) {
            bot.sendMessageExt(msg.chat.id, t("embassy.unlock.nomac"), msg);

            return;
        }

        try {
            const unlockKey = process.env["UNLOCKKEY"];
            if (!unlockKey) throw Error("Environment variable UNLOCKKEY is not provided");

            const token = await encrypt(unlockKey);

            const response = await fetchWithTimeout(`${embassyBase}/unlock`, {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                method: "post",
                body: JSON.stringify({ token, from: msg.from?.username }),
            });

            if (response.ok) {
                logger.info(`${msg.from?.username} opened the door`);
                await bot.sendMessageExt(msg.chat.id, t("embassy.unlock.success"), msg);
            } else throw Error("Request error");
        } catch (error) {
            logger.error(error);
            bot.sendMessageExt(msg.chat.id, t("embassy.common.fail"), msg);
        }
    }

    static async allCamsHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.sendChatAction(msg.chat.id, "upload_photo", msg);

        try {
            const camsPaths = ["webcam", "webcam2", "doorcam"];

            const camResponses = await Promise.allSettled(camsPaths.map(path => fetchWithTimeout(`${embassyBase}/${path}`)));

            const images: ArrayBuffer[] = await Promise.all(
                filterFulfilled(camResponses)
                    .filter(result => result.value.ok)
                    .map(result => result.value.arrayBuffer())
            );

            if (images.length > 0) await bot.sendPhotos(msg.chat.id, images, msg);
            else throw Error("No available images");
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.webcam.failall"), msg);
        }
    }

    static async webcamHandler(bot: HackerEmbassyBot, msg: Message) {
        await EmbassyHandlers.webcamGenericHandler(bot, msg, "webcam", t("embassy.webcam.firstfloor"));
    }

    static async webcam2Handler(bot: HackerEmbassyBot, msg: Message) {
        await EmbassyHandlers.webcamGenericHandler(bot, msg, "webcam2", t("embassy.webcam.secondfloor"));
    }

    static async doorcamHandler(bot: HackerEmbassyBot, msg: Message) {
        await EmbassyHandlers.webcamGenericHandler(bot, msg, "doorcam", t("embassy.webcam.doorcam"));
    }

    static async getWebcamImage(path: string) {
        const response = await (await fetchWithTimeout(`${embassyBase}/${path}`)).arrayBuffer();

        return Buffer.from(response);
    }

    static async liveWebcamHandler(bot: HackerEmbassyBot, msg: Message, path: string, mode: BotMessageContextMode) {
        sleep(1000); // Delay to prevent sending too many requests at once. TODO rework

        try {
            const webcamImage = await EmbassyHandlers.getWebcamImage(path);

            const webcamInlineKeyboard = mode.static
                ? []
                : [
                      [
                          {
                              text: t("status.buttons.refresh"),
                              callback_data: JSON.stringify({ command: `/${path}`, flags: Flags.Editing }),
                          },
                      ],
                  ];

            await bot.editPhoto(webcamImage, msg, {
                reply_markup: {
                    inline_keyboard: webcamInlineKeyboard,
                },
            });
        } catch {
            // Skip this update
        }
    }

    static async webcamGenericHandler(bot: HackerEmbassyBot, msg: Message, path: string, prefix: string) {
        bot.sendChatAction(msg.chat.id, "upload_photo", msg);

        try {
            const mode = bot.context(msg).mode;

            const webcamImage = await EmbassyHandlers.getWebcamImage(path);

            const webcamInlineKeyboard = [
                [
                    {
                        text: t("status.buttons.refresh"),
                        callback_data: JSON.stringify({ command: `/${path}`, flags: Flags.Editing }),
                    },
                    {
                        text: t("status.buttons.save"),
                        callback_data: JSON.stringify({ command: `/removeButtons` }),
                    },
                ],
            ];

            if (webcamImage.byteLength === 0) throw Error("Empty webcam image");

            if (bot.context(msg).isEditing) {
                await bot.editPhoto(webcamImage, msg, {
                    reply_markup: {
                        inline_keyboard: webcamInlineKeyboard,
                    },
                });

                return;
            }

            const resultMessage = await bot.sendPhotoExt(msg.chat.id, webcamImage, msg, {
                reply_markup: {
                    inline_keyboard: webcamInlineKeyboard,
                },
            });

            if (mode.live) {
                bot.addLiveMessage(
                    resultMessage,
                    BotCustomEvent.camLive,
                    () => EmbassyHandlers.liveWebcamHandler(bot, resultMessage, path, mode),
                    {
                        functionName: EmbassyHandlers.liveWebcamHandler.name,
                        module: __filename,
                        params: [resultMessage, path, mode],
                    }
                );
            }
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.webcam.fail", { prefix }), msg);
        }
    }

    /** @deprecated */
    static async monitorHandler(bot: HackerEmbassyBot, msg: Message, notifyEmpty = false) {
        try {
            const statusMessages = await EmbassyHandlers.queryStatusMonitor();

            if (!notifyEmpty && statusMessages.length === 0) return;

            const message =
                statusMessages.length > 0
                    ? TextGenerators.getMonitorMessagesList(statusMessages)
                    : t("embassy.monitor.nonewmessages");

            bot.sendMessageExt(msg.chat.id, message, msg);
        } catch (error) {
            logger.error(error);

            bot.sendMessageExt(msg.chat.id, t("embassy.monitor.fail"), msg);
        }
    }

    static async queryStatusMonitor() {
        return await (await fetchWithTimeout(`${embassyBase}/statusmonitor`)).json();
    }

    /** @deprecated */
    static enableStatusMonitor(bot: HackerEmbassyBot) {
        setInterval(
            () =>
                EmbassyHandlers.monitorHandler(bot, {
                    chat: {
                        id: botConfig.chats.test,
                        type: "private",
                    },
                    message_id: 0,
                    date: Date.now(),
                }),
            embassyApiConfig.queryMonitorInterval
        );
    }

    static async printersHandler(bot: HackerEmbassyBot, msg: Message) {
        const text = TextGenerators.getPrintersInfo();
        const inlineKeyboard = [
            [
                {
                    text: t("embassy.printers.anettestatus"),
                    callback_data: JSON.stringify({ command: "/anettestatus" }),
                },
                {
                    text: t("embassy.printers.plumbusstatus"),
                    callback_data: JSON.stringify({ command: "/plumbusstatus" }),
                },
            ],
        ];

        await bot.sendMessageExt(msg.chat.id, text, msg, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    }

    static async climateHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        let message = t("embassy.climate.nodata");

        try {
            const climateResponse = await fetchWithTimeout(`${embassyBase}/climate`);

            if (!climateResponse.ok) throw Error();

            const climateInfo = (await climateResponse.json()) as SpaceClimate;
            message = t("embassy.climate.data", { climateInfo });

            if (msg.chat.id === botConfig.chats.horny) {
                message += t("embassy.climate.secretdata", { climateInfo });
            }
        } catch (error) {
            logger.error(error);
        }

        return await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async printerStatusHandler(bot: HackerEmbassyBot, msg: Message, printername: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const response = await fetchWithTimeout(`${embassyBase}/printer?printername=${printername}`);

            if (!response.ok) throw Error();

            const { status, thumbnailBuffer, cam } = (await response.json()) as PrinterStatusResponse;

            if (cam) await bot.sendPhotoExt(msg.chat.id, Buffer.from(cam), msg);

            const caption = TextGenerators.getPrinterStatusText(status);
            const inline_keyboard = [
                [
                    {
                        text: t("embassy.printerstatus.update", { printername }),
                        callback_data: JSON.stringify({ command: `/u${printername}status` }),
                    },
                ],
            ];

            if (thumbnailBuffer) {
                await bot.sendOrEditPhoto(msg.chat.id, Buffer.from(thumbnailBuffer), msg, {
                    caption: caption,
                    reply_markup: { inline_keyboard },
                });
            } else await bot.sendOrEditMessage(msg.chat.id, caption, msg, { reply_markup: { inline_keyboard } }, msg.message_id);
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("embassy.printerstatus.fail"), msg);
        }
    }

    static async doorbellHandler(bot: HackerEmbassyBot, msg: Message) {
        try {
            const response = await fetchWithTimeout(`${embassyBase}/doorbell`);

            if (!response.ok) throw Error();

            await bot.sendMessageExt(msg.chat.id, t("embassy.doorbell.success"), msg);
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("embassy.doorbell.fail"), msg);
        }
    }

    static async wakeHandler(bot: HackerEmbassyBot, msg: Message, device: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const response = await fetchWithTimeout(`${embassyBase}/wake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ device }),
                timeout: 15000,
            });

            if (!response.ok) throw Error();

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.wake.success"), msg);
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.wake.fail"), msg);
        }
    }

    static async deviceHelpHandler(bot: HackerEmbassyBot, msg: Message, deviceName: string) {
        try {
            const device = embassyApiConfig.devices[deviceName];

            if (!device) throw Error();

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.help", { deviceName }), msg);
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.notfound"), msg);
        }
    }

    static async shutdownHandler(bot: HackerEmbassyBot, msg: Message, device: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const response = await fetchWithTimeout(`${embassyBase}/shutdown`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ device }),
                timeout: 15000,
            });

            if (!response.ok) throw Error();

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.shutdown.success"), msg);
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.shutdown.fail"), msg);
        }
    }

    static async pingHandler(bot: HackerEmbassyBot, msg: Message, device: string, raw: boolean = false) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const response = await fetchWithTimeout(`${embassyBase}/ping`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ device }),
                timeout: 15000,
            });

            if (!response.ok) throw Error();

            const body = (await response.json()) as PingResponse;

            await bot.sendMessageExt(
                msg.chat.id,
                raw
                    ? body.output
                    : body.alive
                    ? t("embassy.device.alive.up", { time: body.time })
                    : t("embassy.device.alive.down"),
                msg
            );
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.alive.fail"), msg);
        }
    }

    static async announceHandler(bot: HackerEmbassyBot, msg: Message, text: string) {
        await this.playinspaceHandler(bot, msg, `${embassyBase}/rzd.mp3`, true);
        await sleep(7000);
        await this.sayinspaceHandler(bot, msg, text);
    }

    static async knockHandler(bot: HackerEmbassyBot, msg: Message) {
        const residents = usersRepository.getUsers()?.filter(u => hasRole(u.username, "member"));
        const recentUserStates = findRecentStates(statusRepository.getAllUserStates() ?? []);
        const residentsInside = recentUserStates
            .filter(filterPeopleInside)
            .filter(insider => residents?.find(r => r.username === insider.username));

        const text =
            residentsInside.length > 0
                ? t("embassy.knock.knock", {
                      residentsInside: residentsInside.reduce((acc, resident) => acc + `@${resident.username} `, ""),
                  })
                : t("embassy.knock.noresidents");
        await bot.sendMessageExt(msg.chat.id, text, msg);

        if (residentsInside.length > 0) {
            bot.context(msg).mode.silent = true;

            await this.playinspaceHandler(bot, msg, `${embassyBase}/knock.mp3`, true);
            await sleep(9000);
            await this.sayinspaceHandler(
                bot,
                msg,
                `Тук-тук резиденты, к вам хочет зайти ${
                    msg.from?.username ?? msg.from?.first_name
                }. Ответьте ему в главном чатике.`
            );
        }
    }

    static async sayinspaceHandler(bot: HackerEmbassyBot, msg: Message, text: string) {
        bot.sendChatAction(msg.chat.id, "upload_voice", msg);

        try {
            if (!text) {
                bot.sendMessageExt(msg.chat.id, t("embassy.say.help"), msg);
                return;
            }

            const response = await fetchWithTimeout(`${embassyBase}/sayinspace`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ text }),
                timeout: 15000,
            });

            if (response.ok) await bot.sendMessageExt(msg.chat.id, t("embassy.say.success"), msg);
            else throw Error("Failed to say in space");
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("embassy.say.fail"), msg);
        }
    }

    static async playinspaceHandler(bot: HackerEmbassyBot, msg: Message, link: string, silentMessage: boolean = false) {
        bot.sendChatAction(msg.chat.id, "upload_document", msg);

        try {
            if (!link) {
                bot.sendMessageExt(msg.chat.id, t("embassy.play.help"), msg);
                return;
            }

            const response = await fetchWithTimeout(`${embassyBase}/playinspace`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ link }),
                timeout: 15000,
            });

            if (response.ok) !silentMessage && (await bot.sendMessageExt(msg.chat.id, t("embassy.play.success"), msg));
            else throw Error("Failed to play in space");
        } catch (error) {
            logger.error(error);
            !silentMessage && (await bot.sendMessageExt(msg.chat.id, t("embassy.play.fail"), msg));
        }
    }

    static async conditionerHandler(bot: HackerEmbassyBot, msg: Message) {
        if (!bot.context(msg).isEditing) bot.sendChatAction(msg.chat.id, "typing", msg);

        let text = t("embassy.conditioner.unavailable");

        const inlineKeyboard = [
            [
                {
                    text: t("embassy.conditioner.buttons.turnon"),
                    callback_data: JSON.stringify({ command: "/turnonconditioner" }),
                },
                {
                    text: t("embassy.conditioner.buttons.turnoff"),
                    callback_data: JSON.stringify({ command: "/turnoffconditioner" }),
                },
            ],
            [
                {
                    text: t("embassy.conditioner.buttons.more"),
                    callback_data: JSON.stringify({ command: "/addconditionertemp", diff: 1 }),
                },
                {
                    text: t("embassy.conditioner.buttons.less"),
                    callback_data: JSON.stringify({ command: "/addconditionertemp", diff: -1 }),
                },
            ],
            [
                {
                    text: t("embassy.conditioner.buttons.auto"),
                    callback_data: JSON.stringify({ command: "/setconditionermode", mode: "heat_cool" }),
                },
                {
                    text: t("embassy.conditioner.buttons.heat"),
                    callback_data: JSON.stringify({ command: "/setconditionermode", mode: "heat" }),
                },
                {
                    text: t("embassy.conditioner.buttons.cool"),
                    callback_data: JSON.stringify({ command: "/setconditionermode", mode: "cool" }),
                },
                {
                    text: t("embassy.conditioner.buttons.dry"),
                    callback_data: JSON.stringify({ command: "/setconditionermode", mode: "dry" }),
                },
            ],
            [
                {
                    text: t("status.buttons.refresh"),
                    callback_data: JSON.stringify({ command: "/conditioner", flags: Flags.Editing }),
                },
                {
                    text: t("basic.control.buttons.back"),
                    callback_data: JSON.stringify({ command: "/controlpanel" }),
                },
            ],
        ];

        try {
            const response = await fetchWithTimeout(`${embassyBase}/conditionerstate`);
            if (!response.ok) throw Error();

            const conditionerStatus = (await response.json()) as ConditionerStatus;

            text = t("embassy.conditioner.status", { conditionerStatus });
        } catch (error) {
            logger.error(error);
        } finally {
            await bot.sendOrEditMessage(
                msg.chat.id,
                text,
                msg,
                {
                    reply_markup: {
                        inline_keyboard: inlineKeyboard,
                    },
                },
                msg.message_id
            );
        }
    }

    static async turnConditionerHandler(bot: HackerEmbassyBot, msg: Message, enabled: boolean) {
        await EmbassyHandlers.controlConditioner(bot, msg, "turnconditioner", { enabled });
    }

    static async addConditionerTempHandler(bot: HackerEmbassyBot, msg: Message, diff: number) {
        if (isNaN(diff)) throw Error();
        await EmbassyHandlers.controlConditioner(bot, msg, "addconditionertemperature", { diff });
    }

    static async setConditionerTempHandler(bot: HackerEmbassyBot, msg: Message, temperature: number) {
        if (isNaN(temperature)) throw Error();
        await EmbassyHandlers.controlConditioner(bot, msg, "setconditionertemperature", { temperature });
    }

    static async setConditionerModeHandler(bot: HackerEmbassyBot, msg: Message, mode: ConditionerMode) {
        await EmbassyHandlers.controlConditioner(bot, msg, "setconditionermode", { mode });
    }

    static async controlConditioner(bot: HackerEmbassyBot, msg: Message, endpoint: string, body: any) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const response = await fetchWithTimeout(`${embassyBase}/${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) throw Error();

            await bot.sendMessageExt(msg.chat.id, t("embassy.conditioner.success"), msg);
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.conditioner.fail"), msg);
        }
    }
}
