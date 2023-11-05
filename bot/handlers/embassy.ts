import config from "config";
import { Message } from "node-telegram-bot-api";

import { BotConfig, EmbassyApiConfig } from "../../config/schema";
import statusRepository from "../../repositories/statusRepository";
import usersRepository from "../../repositories/usersRepository";
import { ConditionerMode, ConditionerStatus } from "../../services/home";
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

            if (response.status === 200) {
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
                    .filter(result => result.value.status === 200)
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
                              callback_data: JSON.stringify({ command: `/${path}`, edit: true }),
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
                        callback_data: JSON.stringify({ command: `/${path}`, edit: true }),
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
            const climateInfo = climateResponse.status === 200 ? await climateResponse.json() : null;
            if (climateInfo) {
                message = t("embassy.climate.data", { climateInfo });

                if (msg.chat.id === botConfig.chats.horny) {
                    message += t("embassy.climate.secretdata", { climateInfo });
                }
            }
        } catch (error) {
            logger.error(error);
        }

        return await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async printerStatusHandler(bot: HackerEmbassyBot, msg: Message, printername: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const { status, thumbnailBuffer, cam }: PrinterStatusResponse = await (
                await fetchWithTimeout(`${embassyBase}/printer?printername=${printername}`)
            ).json();

            if (!status || status.error) throw Error();

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
        let text = t("embassy.doorbell.success");

        try {
            const status = await (await fetchWithTimeout(`${embassyBase}/doorbell`)).json();
            if (!status || status.error) throw Error();
        } catch (error) {
            logger.error(error);
            text = t("embassy.doorbell.fail");
        } finally {
            await bot.sendMessageExt(msg.chat.id, text, msg);
        }
    }

    static async wakeHandler(bot: HackerEmbassyBot, msg: Message, device: string) {
        let text = t("embassy.wake.success");

        try {
            const response = await fetchWithTimeout(`${embassyBase}/wake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ device }),
                timeout: 15000,
            });

            if (response.status !== 200) throw Error();
        } catch (error) {
            logger.error(error);
            text = t("embassy.wake.fail");
        } finally {
            await bot.sendMessageExt(msg.chat.id, text, msg);
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
                      residentsInside: residentsInside.reduce((acc, resident) => (acc += `@${resident.username} `), ""),
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

            if (response.status === 200) await bot.sendMessageExt(msg.chat.id, t("embassy.say.success"), msg);
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

            if (response.status === 200)
                !silentMessage && (await bot.sendMessageExt(msg.chat.id, t("embassy.play.success"), msg));
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
                    callback_data: JSON.stringify({ command: "/turnconditioneron" }),
                },
                {
                    text: t("embassy.conditioner.buttons.turnoff"),
                    callback_data: JSON.stringify({ command: "/turnconditioneroff" }),
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
                    callback_data: JSON.stringify({ command: "/uconditioner" }),
                },
                {
                    text: t("basic.control.buttons.back"),
                    callback_data: JSON.stringify({ command: "/controlpanel" }),
                },
            ],
        ];

        try {
            const conditionerStatus: Optional<ConditionerStatus> = await (
                await fetchWithTimeout(`${embassyBase}/conditionerstate`)
            ).json();
            if (!conditionerStatus || conditionerStatus.error) throw Error();

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
        let text = t("embassy.conditioner.success");

        try {
            const status = await (
                await fetchWithTimeout(`${embassyBase}/${endpoint}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(body),
                })
            ).json();

            if (!status || status.error) throw Error();
        } catch (error) {
            logger.error(error);
            text = t("embassy.conditioner.fail");
        } finally {
            await bot.sendMessageExt(msg.chat.id, text, msg);
        }
    }
}
