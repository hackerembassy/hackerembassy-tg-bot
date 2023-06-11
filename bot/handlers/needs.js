const NeedsRepository = require("../../repositories/needsRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");

class NeedsHandlers {
    static needsHandler = (bot, msg) => {
        let needs = NeedsRepository.getOpenNeeds();
        let message = TextGenerators.getNeedsList(needs, bot.mode);

        bot.sendMessage(msg.chat.id, message, {
            reply_markup: {
                inline_keyboard: needs.map(need => [
                    {
                        text: need.text,
                        callback_data: JSON.stringify({ command: "/bought", id: need.id }),
                    },
                ]),
            },
        });
    };

    static buyHandler = (bot, msg, text) => {
        let requester = msg.from.username;

        NeedsRepository.addBuy(text, requester, new Date());

        let message = `🙏 ${UsersHelper.formatUsername(
            requester,
            bot.mode
        )} попросил кого-нибудь купить #\`${text}#\` по дороге в спейс.`;

        bot.sendMessage(msg.chat.id, message);
    };

    static boughtByIdHandler = (bot, msg, id) => {
        let need = NeedsRepository.getNeedById(id);
        this.boughtHandler(bot, msg, need.text || "");
    };

    static boughtUndoHandler = (_, msg, id) => {
        const need = NeedsRepository.getNeedById(id);
        if (need && need.buyer === msg.from.username) {
            NeedsRepository.undoClose(need.id);
            return true;
        }
        return false;
    };

    static boughtHandler = (bot, msg, text) => {
        let buyer = msg.from.username;

        let need = NeedsRepository.getOpenNeedByText(text);

        if (!need || need.buyer) {
            bot.sendMessage(msg.chat.id, `🙄 Открытого запроса на покупку с таким именем не нашлось`);
            return;
        }

        let message = `✅ ${UsersHelper.formatUsername(buyer, bot.mode)} купил #\`${text}#\` в спейс`;

        NeedsRepository.closeNeed(text, buyer, new Date());

        bot.sendMessage(msg.chat.id, message, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "❌ Отменить покупку",
                            callback_data: JSON.stringify({ command: "/bought_undo", id: need.id }),
                        },
                    ],
                ],
            },
        });
    };
}

module.exports = NeedsHandlers;
