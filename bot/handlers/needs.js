const NeedsRepository = require("../../repositories/needsRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");

const t = require("../../services/localization");

class NeedsHandlers {
    static needsHandler = async (bot, msg) => {
        const needs = NeedsRepository.getOpenNeeds();
        const text = TextGenerators.getNeedsList(needs, bot.context.mode);
        const inline_keyboard = needs.map(need => [
            {
                text: need.text,
                callback_data: JSON.stringify({ command: "/bought", id: need.id }),
            },
        ]);

        await bot.sendMessage(msg.chat.id, text, {
            reply_markup: { inline_keyboard },
        });
    };

    static buyHandler = async (bot, msg, item) => {
        const requester = msg.from.username;
        const success = NeedsRepository.addBuy(item, requester, new Date());

        await bot.sendMessage(
            msg.chat.id,
            success
                ? t("needs.buy.success", { username: UsersHelper.formatUsername(requester, bot.context.mode), item })
                : t("needs.buy.fail")
        );
    };

    static boughtByIdHandler = async (bot, msg, id) => {
        await this.boughtHandler(bot, msg, NeedsRepository.getNeedById(id).text || "");
    };

    static boughtUndoHandler = (_, msg, id) => {
        const need = NeedsRepository.getNeedById(id);

        if (need && need.buyer === msg.from.username) {
            NeedsRepository.undoClose(need.id);
            return true;
        }

        return false;
    };

    static boughtHandler = async (bot, msg, item) => {
        const buyer = msg.from.username;
        const need = NeedsRepository.getOpenNeedByText(item);

        if (!need || need.buyer) {
            bot.sendMessage(msg.chat.id, t("needs.bought.notfound"));
            return;
        }

        NeedsRepository.closeNeed(item, buyer, new Date());

        const successText = t("needs.bought.success", { username: UsersHelper.formatUsername(buyer, bot.context.mode), item });
        const inline_keyboard = [
            [
                {
                    text: t("needs.bought.undo"),
                    callback_data: JSON.stringify({ command: "/bought_undo", id: need.id }),
                },
            ],
        ];

        await bot.sendMessage(msg.chat.id, successText, {
            reply_markup: { inline_keyboard },
        });
    };
}

module.exports = NeedsHandlers;
