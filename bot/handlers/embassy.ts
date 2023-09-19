import config from "config";
import { Message } from "node-telegram-bot-api";

import { BotConfig, EmbassyApiConfig } from "../../config/schema";
import t from "../../services/localization";
import logger from "../../services/logger";
import { PrinterStatusResponse } from "../../services/printer3d";
import { hasDeviceInside } from "../../services/statusHelper";
import * as TextGenerators from "../../services/textGenerators";
import { sleep } from "../../utils/common";
import { fetchWithTimeout, filterFulfilled } from "../../utils/network";
import { encrypt } from "../../utils/security";
import HackerEmbassyBot, { BotCustomEvent } from "../HackerEmbassyBot";

const embassyApiConfig = config.get("embassy-api") as EmbassyApiConfig;
const botConfig = config.get("bot") as BotConfig;

export default class EmbassyHanlers {
    static async unlockHandler(bot: HackerEmbassyBot, msg: Message) {
        if (!(await hasDeviceInside(msg.from?.username))) {
            bot.sendMessageExt(msg.chat.id, t("embassy.unlock.nomac"), msg);

            return;
        }

        try {
            const unlockKey = process.env["UNLOCKKEY"];
            if (!unlockKey) throw Error("Environment variable UNLOCKKEY is not provided");

            const token = await encrypt(unlockKey);

            const response = await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/unlock`, {
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

            const camResponses = await Promise.allSettled(
                camsPaths.map(path => fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/${path}`))
            );

            const images: ArrayBuffer[] = await Promise.all(
                filterFulfilled(camResponses)
                    .filter(result => result.value?.status === 200)
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
        await EmbassyHanlers.webcamGenericHandler(bot, msg, "webcam", t("embassy.webcam.firstfloor"));
    }

    static async webcam2Handler(bot: HackerEmbassyBot, msg: Message) {
        await EmbassyHanlers.webcamGenericHandler(bot, msg, "webcam2", t("embassy.webcam.secondfloor"));
    }

    static async doorcamHandler(bot: HackerEmbassyBot, msg: Message) {
        await EmbassyHanlers.webcamGenericHandler(bot, msg, "doorcam", t("embassy.webcam.doorcam"));
    }

    static async getWebcamImage(path: string) {
        const response = await (
            await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/${path}`)
        )?.arrayBuffer();

        return Buffer.from(response);
    }

    static async liveWebcamHandler(bot: HackerEmbassyBot, msg: Message, path: string) {
        sleep(1000); // Delay to prevent sending too many requests at once. TODO rework

        try {
            const webcamImage = await EmbassyHanlers.getWebcamImage(path);

            const webcamInlineKeyboard = [
                [
                    {
                        text: t("status.buttons.refresh"),
                        callback_data: JSON.stringify({ command: `/${path}`, edit: true }),
                    },
                ],
            ];

            if (webcamImage)
                await bot.editPhoto(webcamImage, msg, {
                    reply_markup: {
                        inline_keyboard: webcamInlineKeyboard,
                    },
                });
        } catch {
            console.log("SKIP");
            // Skip this update
        }
    }

    static async webcamGenericHandler(bot: HackerEmbassyBot, msg: Message, path: string, prefix: string) {
        bot.sendChatAction(msg.chat.id, "upload_photo", msg);

        try {
            const mode = bot.context(msg).mode;

            const webcamImage = await EmbassyHanlers.getWebcamImage(path);

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

            if (!webcamImage) throw Error("Empty webcam image");

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

            if (mode.live && resultMessage) {
                bot.addLiveMessage(
                    resultMessage,
                    BotCustomEvent.camLive,
                    () => EmbassyHanlers.liveWebcamHandler(bot, resultMessage, path),
                    {
                        functionName: EmbassyHanlers.liveWebcamHandler.name,
                        module: __filename,
                        params: [resultMessage, path],
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
            const statusMessages = await EmbassyHanlers.queryStatusMonitor();

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
        return await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/statusmonitor`))?.json();
    }

    static async enableStatusMonitor(bot: HackerEmbassyBot) {
        setInterval(
            () =>
                EmbassyHanlers.monitorHandler(bot, {
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
                    callback_data: JSON.stringify({ command: "/printerstatus anette" }),
                },
                {
                    text: t("embassy.printers.plumbusstatus"),
                    callback_data: JSON.stringify({ command: "/printerstatus plumbus" }),
                },
            ],
        ];

        bot.sendMessageExt(msg.chat.id, text, msg, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    }

    static async climateHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        let message = t("embassy.climate.nodata");

        try {
            const climateResponse = await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/climate`);
            const climateInfo = climateResponse.status === 200 ? await climateResponse?.json() : null;
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
                await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/printer?printername=${printername}`)
            ).json();

            if (!status || status.error) throw Error();

            if (cam) await bot.sendPhotoExt(msg.chat.id, Buffer.from(cam), msg);

            const caption = await TextGenerators.getPrinterStatusText(status);
            const inline_keyboard = [
                [
                    {
                        text: t("embassy.printerstatus.update", { printername }),
                        callback_data: JSON.stringify({ command: `/printerstatus ${printername}` }),
                    },
                ],
            ];

            if (thumbnailBuffer)
                await bot.sendPhotoExt(msg.chat.id, Buffer.from(thumbnailBuffer), msg, {
                    caption: caption,
                    reply_markup: { inline_keyboard },
                });
            else await bot.sendMessageExt(msg.chat.id, caption, msg, { reply_markup: { inline_keyboard } });
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("embassy.printerstatus.fail"), msg);
        }
    }

    static async doorbellHandler(bot: HackerEmbassyBot, msg: Message) {
        let text = t("embassy.doorbell.success");

        try {
            const status = await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/doorbell`))?.json();
            if (!status || status.error) throw Error();
        } catch (error) {
            logger.error(error);
            text = t("embassy.doorbell.fail");
        } finally {
            await bot.sendMessageExt(msg.chat.id, text, msg);
        }
    }

    static async announceHandler(bot: HackerEmbassyBot, msg: Message, text: string) {
        await this.playinspaceHandler(bot, msg, "http://le-fail.lan:8001/rzd.mp3", true);
        await sleep(7000);
        await this.sayinspaceHandler(bot, msg, text);
    }

    static async sayinspaceHandler(bot: HackerEmbassyBot, msg: Message, text: string) {
        bot.sendChatAction(msg.chat.id, "upload_voice", msg);

        try {
            if (!text) {
                bot.sendMessageExt(msg.chat.id, t("embassy.say.help"), msg);
                return;
            }

            const response = await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/sayinspace`, {
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

            const response = await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/playinspace`, {
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
}
