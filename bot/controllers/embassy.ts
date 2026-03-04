import config from "config";
import { Message } from "node-telegram-bot-api";
import fetch from "node-fetch";

import { BotConfig, EmbassyApiConfig, NeuralConfig } from "@config";
import usersRepository from "@repositories/users";
import fundsRepository from "@repositories/funds";
import broadcast, { BroadcastEvents } from "@services/common/broadcast";
import embassyService from "@services/embassy/embassy";
import { getFundDonationsSummary } from "@services/funds/export";
import { AvailableConditioner, ConditionerActions, ConditionerMode } from "@services/embassy/hass";
import logger from "@services/common/logger";
import { userService, hasRole } from "@services/domain/user";
import { MODEL_NOT_FOUND_ERROR, openwebui } from "@services/neural/openwebui";
import { openAI } from "@services/neural/openai";

import { sleep } from "@utils/common";
import { fullScreenImagePage } from "@utils/html";
import {
    AllowedChats,
    CaptureInteger,
    FeatureFlag,
    Members,
    PublicChats,
    Route,
    TrustedMembers,
    UserRoles,
} from "@hackembot/core/decorators";

import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import { ButtonFlags, InlineButton } from "../core/inlineButtons";
import t from "../core/localization";
import { MessageStreamingError } from "../core/errors";
import { BotCustomEvent, BotController, BotMessageContextMode } from "../core/types";
import * as helpers from "../core/helpers";
import * as TextGenerators from "../text";
import { effectiveName, extractPhotoId, OptionalParam } from "../core/helpers";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const botConfig = config.get<BotConfig>("bot");
const neuralConfig = config.get<NeuralConfig>("neural");

enum DeviceOperation {
    Help = "help",
    Status = "status",
    Up = "up",
    Down = "down",
}

export default class EmbassyController implements BotController {
    @Route(["unlock", "u"], "Unlock the space door")
    @FeatureFlag("embassy")
    @UserRoles(Members)
    static async unlockHandler(bot: HackerEmbassyBot, msg: Message) {
        const user = bot.context(msg).user;

        try {
            const userMacs = userService.getUserMacs(user);
            const hasMacInside = await embassyService.isAnyDeviceInside(userMacs);

            if (!hasMacInside)
                throw Error(`User ${user.username} is not inside, but he/she tried to unlock the door`, {
                    cause: "mac",
                });

            await embassyService.unlockDoorFor(user);

            broadcast.emit(BroadcastEvents.SpaceUnlocked, user.username);

            return bot.sendMessageExt(msg.chat.id, t("embassy.unlock.success"), msg);
        } catch (error) {
            logger.error(error);

            return bot.sendMessageExt(
                msg.chat.id,
                (error as Error).cause === "mac" ? t("embassy.unlock.nomac") : t("embassy.common.fail"),
                msg
            );
        }
    }

    static async unlockedNotificationHandler(bot: HackerEmbassyBot, username: string) {
        try {
            await bot.sendMessageExt(
                botConfig.chats.alerts,
                t("embassy.unlock.success-alert", { user: helpers.formatUsername(username) }),
                null
            );
        } catch (error) {
            logger.error(error);
        }
    }

    @Route(["allcams", "cams", "allcums", "cums", "allc"], "View all cameras")
    @FeatureFlag("embassy")
    @UserRoles(Members)
    static async allCamsHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.sendChatAction(msg.chat.id, "upload_photo", msg);

        try {
            const images = await embassyService.getAllCameras();

            if (images.length > 0) await bot.sendPhotos(msg.chat.id, images, msg);
            else throw Error("No available images");
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.webcam.failall"), msg);
        }
    }

    static async liveWebcamHandler(bot: HackerEmbassyBot, msg: Message, camName: string, mode: BotMessageContextMode) {
        await sleep(1000); // Delay to prevent sending too many requests at once. TODO rework

        try {
            const webcamImage = await embassyService.getWebcamImage(camName);

            const inline_keyboard = mode.static
                ? []
                : [[InlineButton(t("status.buttons.refresh"), `webcam`, ButtonFlags.Editing, { params: camName })]];

            await bot.editPhoto(webcamImage, msg, {
                reply_markup: {
                    inline_keyboard,
                },
            });
        } catch {
            // Skip this update
        }
    }

    @Route(
        ["downstairs", "webcam", "webcum", "cam", "cum", "firstfloor", "ff", "cam1a", "cum1a"],
        "Show downstairs cam",
        null,
        () => ["downstairs"]
    )
    @Route(["upstairs", "webcam2", "webcum2", "cam2", "cum2", "secondfloor", "sf"], "Show upstairs cam", null, () => ["upstairs"])
    @Route(["upstairs2", "sf2"], "Show upstairs 2 cam", null, () => ["upstairs_ptz"])
    @Route(["face", "facecam", "facecum", "facecontrol", "outdoors", "doorcam", "doorcum", "dc"], "Show face cam", null, () => [
        "doorbell",
    ])
    @Route(["kitchen", "kitchencam", "kitchencum", "fridge"], "Show kitchen cam", null, () => ["kitchen"])
    @Route(["meeting_room", "meeting", "meetcam", "meetcum"], "Show meeting room cam", null, () => ["meeting_room"])
    @Route(["balcony", "balcum", "balcam", "balcon"], "Show balcony cam", null, () => ["balcony"])
    @Route(["gw", "precam", "precum", "gatecam", "gateway"], "Show gateway cam", null, () => ["gateway"])
    @FeatureFlag("embassy")
    @UserRoles(Members)
    static async webcamHandler(bot: HackerEmbassyBot, msg: Message, camName: string) {
        bot.sendChatAction(msg.chat.id, "upload_photo", msg);

        try {
            const context = bot.context(msg);
            const mode = context.mode;

            const webcamImage = await embassyService.getWebcamImage(camName);

            const inline_keyboard = [
                [
                    InlineButton(t("status.buttons.refresh"), "webcam", ButtonFlags.Editing, { params: camName }),
                    InlineButton(t("status.buttons.save"), "removebuttons"),
                ],
            ];

            if (webcamImage.byteLength === 0) throw Error("Empty webcam image");

            if (context.isEditing) {
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
                    () => EmbassyController.liveWebcamHandler(bot, resultMessage, camName, mode),
                    {
                        functionName: EmbassyController.liveWebcamHandler.name,
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

    @Route(["printers"], "Get printers status")
    @FeatureFlag("embassy")
    static async printersHandler(bot: HackerEmbassyBot, msg: Message) {
        const text = TextGenerators.getPrintersInfo();
        const inline_keyboard = [
            [InlineButton(t("embassy.printers.anettestatus"), "printerstatus", ButtonFlags.Simple, { params: "anette" })],
            [InlineButton(t("general.buttons.menu"), "startpanel", ButtonFlags.Editing)],
        ];

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

    @Route(["climate", "temp"], "Get climate information")
    @FeatureFlag("embassy")
    static async climateHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const climateInfo = await embassyService.getSpaceClimate();

            const message = t("embassy.climate.data", { climateInfo });
            const secret = msg.chat.id === botConfig.chats.horny ? t("embassy.climate.secretdata", { climateInfo }) : "";

            return bot.sendMessageExt(msg.chat.id, message + secret, msg);
        } catch (error) {
            logger.error(error);
            return bot.sendMessageExt(msg.chat.id, t("embassy.climate.nodata"), msg);
        }
    }

    @Route(["anette", "anettestatus", "anetta", "anettastatus"], "Get Anette printer status", null, () => ["anette"])
    @Route(["printerstatus"], "Get printer status", /(.*\S)/, match => [match[1]])
    @FeatureFlag("embassy")
    static async printerStatusHandler(bot: HackerEmbassyBot, msg: Message, printername: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const { status, thumbnailBuffer, cam } = await embassyService.getPrinterStatus(printername);

            if (cam) await bot.sendPhotoExt(msg.chat.id, Buffer.from(cam), msg);

            const caption = TextGenerators.getPrinterStatusText(status);
            const inline_keyboard = [
                [
                    InlineButton(t("embassy.printerstatus.update", { printername }), "printerstatus", ButtonFlags.Editing, {
                        params: printername,
                    }),
                ],
            ];

            return thumbnailBuffer
                ? bot.sendOrEditPhoto(msg.chat.id, Buffer.from(thumbnailBuffer), msg, {
                      caption: caption,
                      reply_markup: { inline_keyboard },
                  })
                : bot.sendOrEditMessage(msg.chat.id, caption, msg, { reply_markup: { inline_keyboard } }, msg.message_id);
        } catch (error) {
            logger.error(error);
            return !bot.context(msg).isEditing && bot.sendMessageExt(msg.chat.id, t("embassy.printerstatus.fail"), msg);
        }
    }

    @Route(["doorbell", "db"], "Ring the doorbell")
    @FeatureFlag("embassy")
    @UserRoles(Members)
    static async doorbellHandler(bot: HackerEmbassyBot, msg: Message) {
        try {
            await embassyService.doorbell();

            await bot.sendMessageExt(msg.chat.id, t("embassy.doorbell.success"), msg);
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("embassy.doorbell.fail"), msg);
        }
    }

    static async wakeHandler(bot: HackerEmbassyBot, msg: Message, deviceName: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            await embassyService.wakeDevice(deviceName);

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.wake.success"), msg);
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.device.wake.fail"), msg);
        }
    }

    @Route(["gayming", "gaming"], "Manage gaming devices", OptionalParam(/(status|help|up|down)/), match => ["gaming", match[1]])
    @FeatureFlag("embassy")
    @UserRoles(Members)
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
                case DeviceOperation.Up:
                    return EmbassyController.wakeHandler(bot, msg, deviceName);
                case DeviceOperation.Down:
                    return EmbassyController.shutdownHandler(bot, msg, deviceName);
                case DeviceOperation.Status:
                    return EmbassyController.pingHandler(bot, msg, deviceName, false);
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
            await embassyService.shutdownDevice(deviceName);

            return bot.sendMessageExt(msg.chat.id, t("embassy.device.shutdown.success"), msg);
        } catch (error) {
            logger.error(error);

            return bot.sendMessageExt(msg.chat.id, t("embassy.device.shutdown.fail"), msg);
        }
    }

    @Route(["isalive", "alive", "probe"], "Check if a device is alive", /(\S+)/, match => [match[1]])
    @Route(["ping"], "Ping a device", /(\S+)/, match => [match[1], true])
    @FeatureFlag("embassy")
    @UserRoles(Members)
    static async pingHandler(bot: HackerEmbassyBot, msg: Message, deviceName: string, raw: boolean = false) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const body = await embassyService.pingDevice(deviceName);

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

    @Route(["hey"])
    @FeatureFlag("embassy")
    @AllowedChats(PublicChats)
    static async heyHandler(bot: HackerEmbassyBot, msg: Message) {
        const residents = usersRepository.getUsersByRole("member");
        const residentsInside = userService
            .getPeopleInside()
            .filter(insider => residents.find(r => r.username === insider.user.username));

        const text =
            residentsInside.length > 0
                ? t("embassy.hey.text", {
                      residentsInside: residentsInside.reduce((acc, resident) => acc + `@${resident.user.username} `, ""),
                  })
                : t("embassy.hey.noresidents");
        await bot.sendMessageExt(msg.chat.id, text, msg);

        if (residentsInside.length > 0) {
            bot.context(msg).mode.silent = true;

            await EmbassyController.sayinspaceHandler(
                bot,
                msg,
                `Эй, резиденты, вас зовет ${effectiveName(bot.context(msg).user)}. Ответьте пожожда в чатике.`
            );
        }
    }

    @Route(["sayinspace", "say", "announce"], "Announce a message in space", OptionalParam(/(.*)/ims), match => [match[1]])
    @FeatureFlag("embassy")
    static async sayinspaceHandler(bot: HackerEmbassyBot, msg: Message, text: string) {
        bot.sendChatAction(msg.chat.id, "upload_voice", msg);

        try {
            if (!text) return bot.sendMessageExt(msg.chat.id, t("embassy.say.help"), msg);
            const author = bot.context(msg).user;
            await embassyService.tts(`${author.username ?? author.first_name}: ${text}`);

            return bot.sendMessageExt(msg.chat.id, t("embassy.say.success"), msg);
        } catch (error) {
            logger.error(error);
            return bot.sendMessageExt(msg.chat.id, t("embassy.say.fail"), msg);
        }
    }

    @Route(["textinspace", "text"], "Display text in space", OptionalParam(/(.*)/ims), match => [match[1]])
    @FeatureFlag("embassy")
    static async textinspaceHandler(bot: HackerEmbassyBot, msg: Message, text?: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            if (!text || text.length === 0) return bot.sendMessageExt(msg.chat.id, t("embassy.text.help"), msg);

            await embassyService.ledMatrix(text);

            return bot.sendMessageExt(msg.chat.id, t("embassy.text.success"), msg);
        } catch (error) {
            logger.error(error);
            return bot.sendMessageExt(msg.chat.id, t("embassy.text.fail"), msg);
        }
    }

    @Route(["gifinspace", "gif"], "Display a GIF in space", OptionalParam(/(.*)/ims), match => [match[1]])
    @FeatureFlag("embassy")
    static gifinspaceHandler(bot: HackerEmbassyBot, msg: Message, gifUrl?: string) {
        if (!gifUrl || gifUrl.length === 0) return bot.sendMessageExt(msg.chat.id, t("embassy.gif.help"), msg);

        const gifHtml = gifUrl === "clear" || gifUrl === "remove" ? gifUrl : fullScreenImagePage(gifUrl);

        return EmbassyController.htmlinspaceHandler(bot, msg, gifHtml);
    }

    @Route(["htmlinspace", "html"], "Display HTML in space", OptionalParam(/(.*)/ims), match => [match[1]])
    @FeatureFlag("embassy")
    static async htmlinspaceHandler(bot: HackerEmbassyBot, msg: Message, html?: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            if (!html || html.length === 0) return bot.sendMessageExt(msg.chat.id, t("embassy.html.help"), msg);

            switch (html) {
                case "clear":
                case "remove":
                    await embassyService.clearScreen();
                    break;
                default:
                    await embassyService.showScreen(html);
            }

            return bot.sendMessageExt(msg.chat.id, t("embassy.html.success"), msg);
        } catch (error) {
            logger.error(error);
            return bot.sendMessageExt(msg.chat.id, t("embassy.html.fail"), msg);
        }
    }

    @Route(["donationsummary", "textdonations"], "Display donations summary", OptionalParam(/(.*)/), match => [match[1]])
    @FeatureFlag("embassy")
    static async sendDonationsSummaryHandler(bot: HackerEmbassyBot, msg: Message, fund?: string) {
        try {
            const selectedFund = fund ? fundsRepository.getFundByName(fund) : fundsRepository.getLatestCosts();

            if (!selectedFund) throw Error(`No fund ${fund} found`);

            const donationsSummary = await getFundDonationsSummary(selectedFund);

            await EmbassyController.textinspaceHandler(
                bot,
                msg,
                `${donationsSummary.strings.fund_stats}    ${donationsSummary.strings.ranked_donations}`
            );
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("funds.export.fail"), msg);
        }
    }

    @Route(["stopmedia", "stop"], "Stop media playback")
    @FeatureFlag("embassy")
    @UserRoles(TrustedMembers)
    static async stopMediaHandler(bot: HackerEmbassyBot, msg: Message, silentMessage: boolean = false) {
        bot.sendChatAction(msg.chat.id, "upload_document", msg);

        try {
            await embassyService.stopMedia();

            if (!silentMessage) await bot.sendMessageExt(msg.chat.id, t("embassy.stop.success"), msg);
        } catch (error) {
            logger.error(error);
            if (!silentMessage) await bot.sendMessageExt(msg.chat.id, t("embassy.stop.fail"), msg);
        }
    }

    @Route(["availablesounds", "sounds"], "List available sounds")
    @FeatureFlag("embassy")
    @UserRoles(TrustedMembers)
    static async availableSoundsHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const availableSounds = await embassyService.getSounds();
            const sounds = availableSounds.map(s => `#\`/play ${s}#\``).join("\n");

            await bot.sendMessageExt(msg.chat.id, t("embassy.availablesounds.success", { sounds }), msg);
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("embassy.availablesounds.fail"), msg);
        }
    }

    static async voiceInSpaceHandler(bot: HackerEmbassyBot, msg: Message) {
        const context = bot.context(msg);
        const isTrustedOrMember = hasRole(context.user, "trusted", "member");
        const voiceFileId = msg.voice?.file_id;

        if (!context.isPrivate() || !voiceFileId || !isTrustedOrMember) return;

        const link = await bot.getFileLink(voiceFileId);

        return EmbassyController.playinspaceHandler(bot, msg, link);
    }

    @Route(["playinspace", "play"], "Play a sound in space", /(.*)/ims, match => [match[1]])
    @Route(["fartinspace", "fart"], null, null, () => ["fart"])
    @Route(["moaninspace", "moan"], null, null, () => ["moan"])
    @Route(["rickroll", "nevergonnagiveyouup"], null, null, () => ["rickroll"])
    @Route(["rzd"], null, null, () => ["rzd"])
    @Route(["adler"], null, null, () => ["adler"])
    @Route(["rfoxed", "rf0x1d"], null, null, () => ["rfoxed"])
    @Route(["nani", "omaewamoushindeiru"], null, null, () => ["nani"])
    @Route(["zhuchok", "zhenya", "anya", "zhanya"], null, null, () => ["zhuchok"])
    @Route(["badum", "badumtss"], null, null, () => ["badumtss"])
    @Route(["sad", "sadtrombone"], null, null, () => ["sad"])
    @Route(["dushno", "openwindow"], null, null, () => ["dushno"])
    @Route(["anthem", "uk", "british"], null, null, () => ["anthem"])
    @FeatureFlag("embassy")
    @UserRoles(TrustedMembers)
    static async playinspaceHandler(bot: HackerEmbassyBot, msg: Message, linkOrName: string, silentMessage: boolean = false) {
        bot.sendChatAction(msg.chat.id, "upload_document", msg);

        try {
            if (!linkOrName) return bot.sendMessageExt(msg.chat.id, t("embassy.play.help"), msg);

            await embassyService.playSound(linkOrName);

            return !silentMessage && bot.sendMessageExt(msg.chat.id, t("embassy.play.success"), msg);
        } catch (error) {
            logger.error(error);
            return !silentMessage && bot.sendMessageExt(msg.chat.id, t("embassy.play.fail"), msg);
        }
    }

    @Route(["conditioner2", "lg", "ac2", "ac", "upac"], "Controle upstairs AC", null, () => ["upstairs"])
    @Route(["conditioner", "conditioner1", "ac1", "prac", "midea"], "Controle private AC", null, () => ["private"])
    @FeatureFlag("embassy")
    @UserRoles(TrustedMembers)
    static async conditionerHandler(bot: HackerEmbassyBot, msg: Message, name: AvailableConditioner) {
        if (!bot.context(msg).isEditing) bot.sendChatAction(msg.chat.id, "typing", msg);

        let text = t("embassy.conditioner.unavailable");
        const buttonFlags = ButtonFlags.Silent | ButtonFlags.Editing;

        const inline_keyboard = [
            [
                InlineButton(t("embassy.conditioner.buttons.turnon"), "acon", buttonFlags, {
                    params: name,
                }),
                InlineButton(t("embassy.conditioner.buttons.turnoff"), "acoff", buttonFlags, {
                    params: name,
                }),
                InlineButton(t("embassy.conditioner.buttons.preheat"), "preheat", buttonFlags, {
                    params: name,
                }),
            ],
            [
                InlineButton(t("embassy.conditioner.buttons.more"), `acaddtemp`, buttonFlags, {
                    params: [name, 1],
                }),
                InlineButton(t("embassy.conditioner.buttons.less"), `acaddtemp`, buttonFlags, {
                    params: [name, -1],
                }),
            ],
            [
                InlineButton(t("embassy.conditioner.buttons.auto"), `acmode`, buttonFlags, {
                    params: [name, "heat_cool"],
                }),
                InlineButton(t("embassy.conditioner.buttons.heat"), `acmode`, buttonFlags, {
                    params: [name, "heat"],
                }),
                InlineButton(t("embassy.conditioner.buttons.cool"), `acmode`, buttonFlags, {
                    params: [name, "cool"],
                }),
                InlineButton(t("embassy.conditioner.buttons.dry"), `acmode`, buttonFlags, {
                    params: [name, "dry"],
                }),
            ],
            [
                InlineButton(t("status.buttons.refresh"), "conditioner", ButtonFlags.Editing, { params: name }),
                InlineButton(t("basic.control.buttons.back"), "controlpanel", ButtonFlags.Editing),
            ],
        ];

        try {
            const conditionerStatus = await embassyService.getConditionerStatus(name);

            text = t("embassy.conditioner.status", { name, conditionerStatus, firm: name === "private" ? "midea" : "lg" });
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

    @Route(["mideaon", "acon", "ac1on"], "Turn on private AC", null, () => ["private"])
    @Route(["lgon", "ac2on"], "Turn on upstairs AC", null, () => ["upstairs"])
    @FeatureFlag("embassy")
    @UserRoles(TrustedMembers)
    static async turnOnConditionerHandler(bot: HackerEmbassyBot, msg: Message, name: AvailableConditioner) {
        await EmbassyController.controlConditioner(bot, msg, name, ConditionerActions.POWER_ON, null);

        if (bot.context(msg).isButtonResponse) await EmbassyController.conditionerHandler(bot, msg, name);
    }

    @Route(["mideaoff", "acoff", "ac1off"], "Turn off private AC", null, () => ["private"])
    @Route(["lgoff", "ac2off"], "Turn off upstairs AC", null, () => ["upstairs"])
    @FeatureFlag("embassy")
    @UserRoles(TrustedMembers)
    static async turnOffConditionerHandler(bot: HackerEmbassyBot, msg: Message, name: AvailableConditioner) {
        await EmbassyController.controlConditioner(bot, msg, name, ConditionerActions.POWER_OFF, null);

        if (bot.context(msg).isButtonResponse) await EmbassyController.conditionerHandler(bot, msg, name);
    }

    @Route(["mideaaddtemp", "acaddtemp", "ac1addtemp"], "Add temperature to private AC", CaptureInteger, match => [
        "private",
        Number(match[1]),
    ])
    @Route(["lgaddtemp", "ac2addtemp"], "Add temperature to upstairs AC", CaptureInteger, match => ["upstairs", Number(match[1])])
    @FeatureFlag("embassy")
    @UserRoles(TrustedMembers)
    static async addConditionerTempHandler(bot: HackerEmbassyBot, msg: Message, name: AvailableConditioner, diff: number) {
        if (isNaN(diff)) throw Error();
        await EmbassyController.controlConditioner(bot, msg, name, ConditionerActions.TEMPERATURE, { diff });

        if (bot.context(msg).isButtonResponse) {
            await sleep(5000); // Updating the temperature is slow on Midea
            await EmbassyController.conditionerHandler(bot, msg, name);
        }
    }

    @Route(["mideatemp", "actemp", "ac1temp"], "Set temperature for private AC", /(\d*)/, match => ["private", Number(match[1])])
    @Route(["lgtemp", "ac2temp"], "Set temperature for upstairs AC", /(\d*)/, match => ["upstairs", Number(match[1])])
    @FeatureFlag("embassy")
    @UserRoles(TrustedMembers)
    static async setConditionerTempHandler(bot: HackerEmbassyBot, msg: Message, name: AvailableConditioner, temperature: number) {
        if (isNaN(temperature)) throw Error();
        await EmbassyController.controlConditioner(bot, msg, name, ConditionerActions.TEMPERATURE, { temperature });
    }

    @Route(["mideamode", "acmode", "ac1mode"], "Set mode for private AC", /(\S+)/, match => ["private", Number(match[1])])
    @Route(["lgmode", "ac2mode"], "Set mode for upstairs AC", /(\S+)/, match => ["upstairs", Number(match[1])])
    @FeatureFlag("embassy")
    @UserRoles(TrustedMembers)
    static async setConditionerModeHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        name: AvailableConditioner,
        mode: ConditionerMode
    ) {
        await EmbassyController.controlConditioner(bot, msg, name, ConditionerActions.MODE, { mode });

        if (bot.context(msg).isButtonResponse) await EmbassyController.conditionerHandler(bot, msg, name);
    }

    @Route(["preheat"], "Preheat AC")
    @FeatureFlag("embassy")
    @UserRoles(Members)
    static async preheatHandler(bot: HackerEmbassyBot, msg: Message, name: AvailableConditioner) {
        await EmbassyController.controlConditioner(bot, msg, name, ConditionerActions.PREHEAT, {});

        if (bot.context(msg).isButtonResponse) await EmbassyController.conditionerHandler(bot, msg, name);
    }

    static async controlConditioner(
        bot: HackerEmbassyBot,
        msg: Message,
        name: AvailableConditioner,
        action: ConditionerActions,
        body: unknown
    ) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            await embassyService.controlConditioner(name, action, body);

            await bot.sendMessageExt(msg.chat.id, t("embassy.conditioner.success"), msg);
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.conditioner.fail"), msg);
        }
    }

    @Route(
        ["txt2img", "img2img", "toimg", "sd", "generateimage"],
        "Generate image using Stable Diffusion",
        OptionalParam(/(.*)/ims),
        match => [match[1]]
    )
    @FeatureFlag("ai")
    @AllowedChats(PublicChats)
    static async stableDiffusiondHandler(bot: HackerEmbassyBot, msg: Message, prompt: string) {
        const photoId = msg.photo?.[0]?.file_id;

        if (msg.chat.id !== botConfig.chats.horny && !hasRole(bot.context(msg).user, "trusted", "member"))
            return bot.sendRestrictedMessage(msg);
        if (!prompt && !photoId) return bot.sendMessageExt(msg.chat.id, t("embassy.neural.sd.help"), msg);

        try {
            bot.sendChatAction(msg.chat.id, "upload_document", msg);

            const [positive_prompt, negative_prompt] = prompt ? prompt.split("!=", 2).map(pr => pr.trim()) : ["", ""];
            const imageBuffer = await (photoId
                ? embassyService.img2img(positive_prompt, negative_prompt, await bot.fetchFileAsBase64(photoId))
                : embassyService.txt2img(positive_prompt, negative_prompt));

            return bot.sendPhotoExt(msg.chat.id, imageBuffer, msg);
        } catch (error) {
            logger.error(error);
            return bot.sendMessageExt(msg.chat.id, t("embassy.neural.sd.fail"), msg);
        }
    }

    @Route(["models"], "List available AI models")
    @FeatureFlag("ai")
    @AllowedChats(PublicChats)
    static async availableModelsHandler(bot: HackerEmbassyBot, msg: Message) {
        const openwebuiModels = await openwebui.getModels();
        const models = [neuralConfig.openai.model, ...openwebuiModels, "burivuh26"];
        const modelsList = TextGenerators.getModelsList(models, neuralConfig.openwebui.model);

        return bot.sendMessageExt(msg.chat.id, t("embassy.neural.models", { modelsList }), msg);
    }

    @Route(["ask"], "Ask a question to the AI", OptionalParam(/(\S+?)(?: (.*))?/ims), match => [match[2], match[1]])
    @Route(["gpt"], "Ask a question to GPT", OptionalParam(/(.*)/ims), match => [match[1], "gpt"])
    @Route(
        ["ollama", "llama", "lama", "openwebui"],
        "Ask a question to the specified AI model",
        OptionalParam(/(.*)/ims),
        match => [match[1]]
    )
    @FeatureFlag("ai")
    @AllowedChats(PublicChats)
    static async askHandler(bot: HackerEmbassyBot, msg: Message, prompt?: string, model?: string) {
        const user = bot.context(msg).user;

        if (msg.chat.id !== botConfig.chats.horny && !hasRole(user, "trusted", "member")) return bot.sendRestrictedMessage(msg);

        const replyPrompt = msg.reply_to_message?.text ?? msg.reply_to_message?.caption;
        const combined = prompt && replyPrompt ? `${replyPrompt}\n ${prompt}`.trim() : (prompt ?? replyPrompt);
        const photoId = extractPhotoId(msg.reply_to_message?.photo) ?? extractPhotoId(msg.photo);
        const imageBase64 = photoId ? await bot.fetchFileAsBase64(photoId) : undefined;

        if (!combined) return bot.sendMessageExt(msg.chat.id, t("embassy.neural.ask.help") + t("embassy.neural.ask.usage"), msg);

        const loading = setInterval(() => bot.sendChatAction(msg.chat.id, "typing", msg), 5000);

        try {
            bot.sendChatAction(msg.chat.id, "typing", msg);

            if (model === "burivuh26" || model === "burivuh") {
                return bot.sendMessageExt(msg.chat.id, `@burivuh26, ${combined}`, msg);
            }

            if (model === "gpt" || model === neuralConfig.openai.model)
                return bot.sendMessageExt(msg.chat.id, await openAI.askChat(combined, t("embassy.neural.contexts.default")), msg);

            await bot.sendStreamedMessage(msg.chat.id, await openwebui.generateOpenAiStream(combined, imageBase64, model), msg);
        } catch (error) {
            if (error instanceof MessageStreamingError && error.message === MODEL_NOT_FOUND_ERROR) {
                return bot.sendMessageExt(
                    msg.chat.id,
                    t("embassy.neural.ask.modelnotfound", { model }) + "\n" + t("embassy.neural.ask.usage"),
                    msg
                );
            }
            bot.sendMessageExt(msg.chat.id, t("embassy.neural.ask.error"), msg);
            logger.error(error);
        } finally {
            clearInterval(loading);
        }
    }

    @Route(["ena", "checkena", "checkoutages", "outages"], "Check if there is an electricity outage in the embassy area")
    @FeatureFlag("outage")
    static async checkOutageMentionsHandler(bot: HackerEmbassyBot, msg?: Message) {
        const destinationChat = msg?.chat.id ?? botConfig.chats.alerts;
        const street = botConfig.outage.electricity.target;
        const endpoint = botConfig.outage.electricity.endpoint;

        try {
            const enaPageContent = await fetch(endpoint).then(res => res.text());
            const isElectricityOutage = enaPageContent.toLowerCase().includes(street.toLowerCase());
            const needToRespond = msg || bot.botState.flags.electricityOutageMentioned !== isElectricityOutage;

            if (!needToRespond) return;

            if (!msg) {
                bot.botState.flags.electricityOutageMentioned = isElectricityOutage;
                await bot.botState.persistChanges();
            }

            await bot.sendMessageExt(
                destinationChat,
                t(isElectricityOutage ? "embassy.ena.mentioned" : "embassy.ena.notmentioned", {
                    hystreet: street,
                    street: t("embassy.ena.street"),
                    link: endpoint,
                }),
                msg ?? null
            );
        } catch (error) {
            logger.error(error);
            if (msg) await bot.sendMessageExt(msg.chat.id, t("embassy.ena.fail"), msg);
        }
    }
}
