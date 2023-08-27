const { fetchWithTimeout } = require("../../utils/network");
const logger = require("../../services/logger");
const { encrypt } = require("../../utils/security");
const { hasDeviceInside } = require("../../services/statusHelper");

const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const botConfig = config.get("bot");

const TextGenerators = require("../../services/textGenerators");

const t = require("../../services/localization");

/**
 * @typedef {import("../HackerEmbassyBot").HackerEmbassyBot} HackerEmbassyBot
 * @typedef {import("node-telegram-bot-api").Message} Message
 */

class EmbassyHanlers {
    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async unlockHandler(bot, msg) {
        if (!(await hasDeviceInside(msg.from.username))) {
            bot.sendMessageExt(msg.chat.id, t("embassy.unlock.nomac"), msg);

            return;
        }

        try {
            const token = await encrypt(process.env["UNLOCKKEY"]);

            const response = await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/unlock`, {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                method: "post",
                body: JSON.stringify({ token, from: msg.from.username }),
            });

            if (response.status === 200) {
                logger.info(`${msg.from.username} opened the door`);
                await bot.sendMessageExt(msg.chat.id, t("embassy.unlock.success"), msg);
            } else throw Error("Request error");
        } catch (error) {
            logger.error(error);
            bot.sendMessageExt(msg.chat.id, t("embassy.common.fail"), msg);
        }
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async webcamHandler(bot, msg) {
        await this.webcamGenericHandler(bot, msg, "webcam", t("embassy.webcam.firstfloor"));
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async webcam2Handler(bot, msg) {
        await this.webcamGenericHandler(bot, msg, "webcam2", t("embassy.webcam.secondfloor"));
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async doorcamHandler(bot, msg) {
        await this.webcamGenericHandler(bot, msg, "doorcam", t("embassy.webcam.doorcam"));
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async webcamGenericHandler(bot, msg, path, prefix) {
        bot.sendChatAction(msg.chat.id, "upload_photo", msg);

        try {
            const response = await (
                await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/${path}`)
            )?.arrayBuffer();

            const webcamImage = Buffer.from(response);

            if (webcamImage) await bot.sendPhotoExt(msg.chat.id, webcamImage, msg);
            else throw Error("Empty webcam image");
        } catch (error) {
            logger.error(error);

            await bot.sendMessageExt(msg.chat.id, t("embassy.webcam.fail", { prefix }), msg);
        }
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async monitorHandler(bot, msg, notifyEmpty = false) {
        try {
            const statusMessages = await this.queryStatusMonitor();

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

    /**
     * @param {HackerEmbassyBot} bot
     */
    static async enableStatusMonitor(bot) {
        setInterval(
            () =>
                this.monitorHandler(bot, {
                    chat: {
                        id: botConfig.chats.test,
                        type: "private",
                    },
                    message_id: undefined,
                    date: undefined,
                }),
            embassyApiConfig.queryMonitorInterval
        );
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async printersHandler(bot, msg) {
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

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async climateHandler(bot, msg) {
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

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async printerStatusHandler(bot, msg, printername) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        try {
            const { status, thumbnailBuffer, cam } = await (
                await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/printer?printername=${printername}`)
            ).json();

            if (!status || status.error) throw Error();

            if (cam) await bot.sendPhotoExt(msg.chat.id, Buffer.from(cam), msg);

            const caption = await TextGenerators.getPrinterStatus(status);
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

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async doorbellHandler(bot, msg) {
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

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async sayinspaceHandler(bot, msg, text) {
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

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async playinspaceHandler(bot, msg, link) {
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

            if (response.status === 200) await bot.sendMessageExt(msg.chat.id, t("embassy.play.success"), msg);
            else throw Error("Failed to play in space");
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("embassy.play.fail"), msg);
        }
    }
}

module.exports = EmbassyHanlers;
