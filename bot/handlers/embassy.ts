import config from "config";
import { Message } from "node-telegram-bot-api";
import { PingResponse } from "ping";
import { dir } from "tmp-promise";

import { BotConfig, EmbassyApiConfig } from "../../config/schema";
import statusRepository from "../../repositories/statusRepository";
import usersRepository from "../../repositories/usersRepository";
import { EmbassyBase, requestToEmbassy } from "../../services/embassy";
import { ConditionerMode, ConditionerStatus, SpaceClimate } from "../../services/hass";
import t from "../../services/localization";
import logger from "../../services/logger";
import { PrinterStatusResponse } from "../../services/printer3d";
import { filterPeopleInside, findRecentStates, hasDeviceInside } from "../../services/statusHelper";
import * as TextGenerators from "../../services/textGenerators";
import broadcast, { BroadcastEvents } from "../../utils/broadcast";
import { sleep } from "../../utils/common";
import { readFileAsBase64 } from "../../utils/filesystem";
import { filterFulfilled } from "../../utils/network";
import { encrypt } from "../../utils/security";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { BotCustomEvent, BotHandlers, BotMessageContextMode } from "../core/types";
import { hasRole, InlineButton } from "../helpers";
import * as helpers from "../helpers";
import { Flags } from "./service";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const botConfig = config.get<BotConfig>("bot");

enum DeviceOperation {
    Help = "help",
    Status = "status",
    Up = "up",
    Down = "down",
}

type SdToImageRequest = {
    prompt: string;
    negative_prompt?: string;
    image?: string;
};

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

            const response = await requestToEmbassy(`/space/unlock`, "POST", { token, from: msg.from?.username });

            if (response.ok) {
                logger.info(`${msg.from?.username} opened the door`);
                await bot.sendMessageExt(msg.chat.id, t("embassy.unlock.success"), msg);
                broadcast.emit(BroadcastEvents.SpaceUnlocked, msg.from?.username);
            } else throw Error("Request error");
        } catch (error) {
            logger.error(error);
            bot.sendMessageExt(msg.chat.id, t("embassy.common.fail"), msg);
        }
    }

    static async unlockedNotificationHandler(bot: HackerEmbassyBot, username: string) {
        await bot.sendMessageExt(
            botConfig.chats.alerts,
            t("embassy.unlock.success-alert", { user: helpers.formatUsername(username, { mention: false }) }),
            null
        );
    }

    static async allCamsHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.sendChatAction(msg.chat.id, "upload_photo", msg);

        try {
            const camNames = Object.keys(embassyApiConfig.cams);
            const camResponses = await Promise.allSettled(camNames.map(name => requestToEmbassy(`/webcam/${name}`)));

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

    static async getWebcamImage(camName: string) {
        const response = await (await requestToEmbassy(`/webcam/${camName}`)).arrayBuffer();

        return Buffer.from(response);
    }

    static async liveWebcamHandler(bot: HackerEmbassyBot, msg: Message, camName: string, mode: BotMessageContextMode) {
        sleep(1000); // Delay to prevent sending too many requests at once. TODO rework

        try {
            const webcamImage = await EmbassyHandlers.getWebcamImage(camName);

            const inline_keyboard = mode.static
                ? []
                : [[InlineButton(t("status.buttons.refresh"), `webcam`, Flags.Editing, { params: camName })]];

            await bot.editPhoto(webcamImage, msg, {
                reply_markup: {
                    inline_keyboard,
                },
            });
        } catch {
            // Skip this update
        }
    }

    static async webcamHandler(bot: HackerEmbassyBot, msg: Message, camName: string) {
        bot.sendChatAction(msg.chat.id, "upload_photo", msg);

        try {
            const mode = bot.context(msg).mode;

            const webcamImage = await EmbassyHandlers.getWebcamImage(camName);

            const inline_keyboard = [
                [
                    InlineButton(t("status.buttons.refresh"), "webcam", Flags.Editing, { params: camName }),
                    InlineButton(t("status.buttons.save"), "removebuttons"),
                ],
            ];

            if (webcamImage.byteLength === 0) throw Error("Empty webcam image");

            if (bot.context(msg).isEditing) {
                await bot.editPhoto(webcamImage, msg, {
                    reply_markup: {
                        inline_keyboard,
                    },
                });

                return;
            }

            const resultMessage = await bot.sendPhotoExt(msg.chat.id, webcamImage, msg, {
                reply_markup: {
                    inline_keyboard,
                },
            });

            if (mode.live) {
                bot.addLiveMessage(
                    resultMessage,
                    BotCustomEvent.camLive,
                    () => EmbassyHandlers.liveWebcamHandler(bot, resultMessage, camName, mode),
                    {
                        functionName: EmbassyHandlers.liveWebcamHandler.name,
                        module: __filename,
                        params: [resultMessage, camName, mode],
                    }
                );
            }
        } catch (error) {
            logger.error(error);
            const camLocationName = t(`embassy.webcam.location.${camName}`);

            await bot.sendMessageExt(msg.chat.id, t("embassy.webcam.fail", { camLocationName }), msg);
        }
    }

    static async printersHandler(bot: HackerEmbassyBot, msg: Message) {
        const text = TextGenerators.getPrintersInfo();
        const inline_keyboard = [
            [
                InlineButton(t("embassy.printers.anettestatus"), "printerstatus", Flags.Simple, { params: "anette" }),
                InlineButton(t("embassy.printers.plumbusstatus"), "printerstatus", Flags.Simple, { params: "plumbus" }),
            ],
        ];

        await bot.sendMessageExt(msg.chat.id, text, msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static async climateHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        let message = t("embassy.climate.nodata");

        try {
            const climateResponse = await requestToEmbassy(`/climate`);

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
            const response = await requestToEmbassy(`/printer/${printername}`);

            if (!response.ok) throw Error();

            const { status, thumbnailBuffer, cam } = (await response.json()) as PrinterStatusResponse;

            if (cam) await bot.sendPhotoExt(msg.chat.id, Buffer.from(cam), msg);

            const caption = TextGenerators.getPrinterStatusText(status);
            const inline_keyboard = [
                [
                    InlineButton(t("embassy.printerstatus.update", { printername }), "printerstatus", Flags.Editing, {
                        params: "plumbus",
                    }),
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
            const response = await requestToEmbassy(`/space/doorbell`);

            if (!response.ok) throw Error();

            await bot.sendMessageExt(msg.chat.id, t("embassy.doorbell.success"), msg);
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("embassy.doorbell.fail"), msg);
        }
    }

    static async wakeHandler(bot: HackerEmbassyBot, msg: Message, deviceName: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const response = await requestToEmbassy(`/device/${deviceName}/wake`, "POST");

            if (!response.ok) throw Error();

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.wake.success"), msg);
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.wake.fail"), msg);
        }
    }

    static async deviceHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        deviceName: string,
        operation: DeviceOperation = DeviceOperation.Help
    ) {
        try {
            const device = embassyApiConfig.devices[deviceName];

            if (!device) throw Error();

            switch (operation) {
                case "up":
                    return EmbassyHandlers.wakeHandler(bot, msg, deviceName);
                case "down":
                    return EmbassyHandlers.shutdownHandler(bot, msg, deviceName);
                case "status":
                    return EmbassyHandlers.pingHandler(bot, msg, deviceName, false);
                default:
                    break;
            }

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.help", { deviceName }), msg);
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.notfound"), msg);
        }
    }

    static async shutdownHandler(bot: HackerEmbassyBot, msg: Message, deviceName: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const response = await requestToEmbassy(`/device/${deviceName}/shutdown`, "POST");

            if (!response.ok) throw Error();

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.shutdown.success"), msg);
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.shutdown.fail"), msg);
        }
    }

    static async pingHandler(bot: HackerEmbassyBot, msg: Message, deviceName: string, raw: boolean = false) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const response = await requestToEmbassy(`/device/${deviceName}/ping`, "POST");

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
        await EmbassyHandlers.playinspaceHandler(bot, msg, "rzd", true);
        await sleep(7000);
        await EmbassyHandlers.sayinspaceHandler(bot, msg, text);
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

            await EmbassyHandlers.playinspaceHandler(bot, msg, "knock", true);
            await sleep(9000);
            await EmbassyHandlers.sayinspaceHandler(
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

            const response = await requestToEmbassy(`/speaker/tts`, "POST", { text });

            if (response.ok) await bot.sendMessageExt(msg.chat.id, t("embassy.say.success"), msg);
            else throw Error("Failed to say in space");
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("embassy.say.fail"), msg);
        }
    }

    static async stopMediaHandler(bot: HackerEmbassyBot, msg: Message, silentMessage: boolean = false) {
        bot.sendChatAction(msg.chat.id, "upload_document", msg);

        try {
            const response = await requestToEmbassy(`/speaker/stop`, "POST");

            if (response.ok) !silentMessage && (await bot.sendMessageExt(msg.chat.id, t("embassy.stop.success"), msg));
            else throw Error("Failed to stop media in space");
        } catch (error) {
            logger.error(error);
            !silentMessage && (await bot.sendMessageExt(msg.chat.id, t("embassy.stop.fail"), msg));
        }
    }

    static async availableSoundsHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const response = await requestToEmbassy(`/speaker/sounds`);

            if (response.ok) {
                const { sounds } = (await response.json()) as { sounds: string[] };
                const soundsText = sounds.map(s => `#\`/play ${s}#\``).join("\n");

                await bot.sendMessageExt(msg.chat.id, t("embassy.availablesounds.success", { sounds: soundsText }), msg);
            } else throw Error("Failed to fetch available sounds");
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("embassy.availablesounds.fail"), msg);
        }
    }

    static async playinspaceHandler(bot: HackerEmbassyBot, msg: Message, linkOrName: string, silentMessage: boolean = false) {
        bot.sendChatAction(msg.chat.id, "upload_document", msg);

        try {
            if (!linkOrName) {
                bot.sendMessageExt(msg.chat.id, t("embassy.play.help"), msg);
                return;
            }

            const link = linkOrName.startsWith("http") ? linkOrName : `${EmbassyBase}/${linkOrName}.mp3`;

            const response = await requestToEmbassy(`/speaker/play`, "POST", { link });

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

        const inline_keyboard = [
            [
                InlineButton(t("embassy.conditioner.buttons.turnon"), "turnconditioner", Flags.Silent | Flags.Editing, {
                    params: true,
                }),
                InlineButton(t("embassy.conditioner.buttons.turnoff"), "turnconditioner", Flags.Silent | Flags.Editing, {
                    params: false,
                }),
            ],
            [
                InlineButton(t("embassy.conditioner.buttons.more"), "addconditionertemp", Flags.Silent | Flags.Editing, {
                    params: 1,
                }),
                InlineButton(t("embassy.conditioner.buttons.less"), "addconditionertemp", Flags.Silent | Flags.Editing, {
                    params: -1,
                }),
            ],
            [
                InlineButton(t("embassy.conditioner.buttons.auto"), "setconditionermode", Flags.Silent | Flags.Editing, {
                    params: "heat_cool",
                }),
                InlineButton(t("embassy.conditioner.buttons.heat"), "setconditionermode", Flags.Silent | Flags.Editing, {
                    params: "heat",
                }),
                InlineButton(t("embassy.conditioner.buttons.cool"), "setconditionermode", Flags.Silent | Flags.Editing, {
                    params: "cool",
                }),
                InlineButton(t("embassy.conditioner.buttons.dry"), "setconditionermode", Flags.Silent | Flags.Editing, {
                    params: "dry",
                }),
            ],
            [
                InlineButton(t("status.buttons.refresh"), "conditioner", Flags.Editing),
                InlineButton(t("basic.control.buttons.back"), "controlpanel", Flags.Editing),
            ],
        ];

        try {
            const response = await requestToEmbassy(`/conditioner/state`);

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
                        inline_keyboard,
                    },
                },
                msg.message_id
            );
        }
    }

    static async turnConditionerHandler(bot: HackerEmbassyBot, msg: Message, enabled: boolean) {
        await EmbassyHandlers.controlConditioner(bot, msg, `/conditioner/power/${enabled ? "on" : "off"}`, null);

        if (bot.context(msg).isButtonResponse) await EmbassyHandlers.conditionerHandler(bot, msg);
    }

    static async addConditionerTempHandler(bot: HackerEmbassyBot, msg: Message, diff: number) {
        if (isNaN(diff)) throw Error();
        await EmbassyHandlers.controlConditioner(bot, msg, "/conditioner/temperature", { diff });

        if (bot.context(msg).isButtonResponse) {
            await sleep(5000); // Updating the temperature is slow on Midea
            await EmbassyHandlers.conditionerHandler(bot, msg);
        }
    }

    static async setConditionerTempHandler(bot: HackerEmbassyBot, msg: Message, temperature: number) {
        if (isNaN(temperature)) throw Error();
        await EmbassyHandlers.controlConditioner(bot, msg, "/conditioner/temperature", { temperature });
    }

    static async setConditionerModeHandler(bot: HackerEmbassyBot, msg: Message, mode: ConditionerMode) {
        await EmbassyHandlers.controlConditioner(bot, msg, "/conditioner/mode", { mode });

        if (bot.context(msg).isButtonResponse) await EmbassyHandlers.conditionerHandler(bot, msg);
    }

    static async controlConditioner(bot: HackerEmbassyBot, msg: Message, endpoint: string, body: any) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const response = await requestToEmbassy(endpoint, "POST", body);

            if (!response.ok) throw Error();

            await bot.sendMessageExt(msg.chat.id, t("embassy.conditioner.success"), msg);
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.conditioner.fail"), msg);
        }
    }

    static async stableDiffusiondHandler(bot: HackerEmbassyBot, msg: Message, prompt: string) {
        bot.sendChatAction(msg.chat.id, "upload_document", msg);

        const photoId = msg.photo?.[0]?.file_id;

        try {
            if (!prompt && !photoId) {
                bot.sendMessageExt(msg.chat.id, t("embassy.neural.sd.help"), msg);
                return;
            }

            const [positive_prompt, negative_prompt] = prompt ? prompt.split("!=", 2).map(pr => pr.trim()) : ["", ""];

            const requestBody = { prompt: positive_prompt, negative_prompt } as SdToImageRequest;

            if (photoId) {
                const { path, cleanup } = await dir({
                    unsafeCleanup: true,
                });
                const photoPath = await bot.downloadFile(photoId, path);
                requestBody.image = await readFileAsBase64(photoPath);
                cleanup();
            }

            const response = await requestToEmbassy(photoId ? "/sd/img2img" : "/sd/txt2img", "POST", requestBody);

            if (response.ok) {
                const body = (await response.json()) as { image: string };
                const imageBuffer = Buffer.from(body.image, "base64");

                await bot.sendPhotoExt(msg.chat.id, imageBuffer, msg);
            } else throw Error("Failed to generate an image");
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("embassy.neural.sd.fail"), msg);
        }
    }
}
