const { fetchWithTimeout } = require("../../utils/network");
const logger = require("../../services/logger");
const { encrypt } = require("../../utils/security");
const { hasDeviceInside } = require("../../services/statusHelper");

const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const botConfig = config.get("bot");

const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");

const t = require("../../services/localization");

class EmbassyHanlers {
    static unlockHandler = async (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;

        if (!(await hasDeviceInside(msg.from.username))) {
            bot.sendMessage(msg.chat.id, t("embassy.unlock.nomac"));

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
                await bot.sendMessage(msg.chat.id, t("embassy.unlock.success"));
            } else throw Error("Request error");
        } catch (error) {
            logger.error(error);
            bot.sendMessage(msg.chat.id, t("embassy.common.fail"));
        }
    };

    static webcamHandler = async (bot, msg) => {
        await this.webcamGenericHandler(bot, msg, "webcam", t("embassy.webcam.firstfloor"));
    };

    static webcam2Handler = async (bot, msg) => {
        await this.webcamGenericHandler(bot, msg, "webcam2", t("embassy.webcam.secondfloor"));
    };

    static doorcamHandler = async (bot, msg) => {
        await this.webcamGenericHandler(bot, msg, "doorcam", t("embassy.webcam.doorcam"));
    };

    static webcamGenericHandler = async (bot, msg, path, prefix) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;

        try {
            const response = await (
                await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/${path}`)
            )?.arrayBuffer();

            const webcamImage = Buffer.from(response);

            if (webcamImage) await bot.sendPhoto(msg.chat.id, webcamImage);
            else throw Error("Empty webcam image");
        } catch (error) {
            logger.error(error);

            await bot.sendMessage(msg.chat.id, t("embassy.webcam.fail", { prefix }));
        }
    };

    static monitorHandler = async (bot, msg, notifyEmpty = false) => {
        try {
            const statusMessages = await this.queryStatusMonitor();

            if (!notifyEmpty && statusMessages.length === 0) return;

            const message =
                statusMessages.length > 0
                    ? TextGenerators.getMonitorMessagesList(statusMessages)
                    : t("embassy.monitor.nonewmessages");

            bot.sendMessage(msg.chat.id, message);
        } catch (error) {
            logger.error(error);

            bot.sendMessage(msg.chat.id, t("embassy.monitor.fail"));
        }
    };

    static queryStatusMonitor = async () => {
        return await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/statusmonitor`))?.json();
    };

    static enableStatusMonitor(bot) {
        setInterval(
            () => this.monitorHandler(bot, { chat: { id: botConfig.chats.test } }),
            embassyApiConfig.queryMonitorInterval
        );
    }

    static printersHandler = async (bot, msg) => {
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

        bot.sendMessage(msg.chat.id, text, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    };

    static climateHandler = async (bot, msg) => {
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

        return await bot.sendMessage(msg.chat.id, message);
    };

    static printerStatusHandler = async (bot, msg, printername) => {
        try {
            const { status, thumbnailBuffer, cam } = await (
                await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/printer?printername=${printername}`)
            ).json();

            if (!status || status.error) throw Error();

            if (cam) await bot.sendPhoto(msg.chat.id, Buffer.from(cam));

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
                await bot.sendPhoto(msg.chat.id, Buffer.from(thumbnailBuffer), {
                    caption: caption,
                    reply_markup: { inline_keyboard },
                });
            else await bot.sendMessage(msg.chat.id, caption, { reply_markup: { inline_keyboard } });
        } catch (error) {
            logger.error(error);
            await bot.sendMessage(msg.chat.id, t("embassy.printerstatus.fail"));
        }
    };

    static doorbellHandler = async (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin", "member")) return;

        let text = t("embassy.doorbell.success");

        try {
            const status = await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/doorbell`))?.json();
            if (!status || status.error) throw Error();
        } catch (error) {
            logger.error(error);
            text = t("embassy.doorbell.fail");
        } finally {
            await bot.sendMessage(msg.chat.id, text);
        }
    };

    static sayinspaceHandler = async (bot, msg, text) => {
        try {
            if (!text) {
                bot.sendMessage(msg.chat.id, t("embassy.say.help"));
                return;
            }

            const response = await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/sayinspace`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ text }),
            });

            if (response.status === 200) await bot.sendMessage(msg.chat.id, t("embassy.say.success"));
            else throw Error("Failed to say in space");
        } catch (error) {
            logger.error(error);
            await bot.sendMessage(msg.chat.id, t("embassy.say.fail"));
        }
    };

    static playinspaceHandler = async (bot, msg, link) => {
        try {
            if (!link) {
                bot.sendMessage(msg.chat.id, t("embassy.play.help"));
                return;
            }

            const response = await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/playinspace`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ link }),
            });

            if (response.status === 200) await bot.sendMessage(msg.chat.id, t("embassy.play.success"));
            else throw Error("Failed to play in space");
        } catch (error) {
            logger.error(error);
            await bot.sendMessage(msg.chat.id, t("embassy.play.fail"));
        }
    };
}

module.exports = EmbassyHanlers;
