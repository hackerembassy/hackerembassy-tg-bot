const UsersRepository = require("../../repositories/usersRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const Commands = require("../../resources/commands");
const CoinsHelper = require("../../resources/coins/coins");
const BaseHandlers = require("./base");

class BasicHandlers extends BaseHandlers {
  constructor() {
    super();
  }

  startHandler = (msg) => {
    this.bot.sendMessage(
      msg.chat.id,
      `🛠 Привет хакерчан. Я новый бот для менеджмента всяких процессов в спейсе. 
[Я еще нахожусь в разработке, ты можешь поучаствовать в моем развитии в репозитории на гитхабе спейса].
Держи мой список команд:\n` +
        UsersHelper.getAvailableCommands(msg.from.username) +
        `${Commands.GlobalModifiers}`,
      { parse_mode: "Markdown" }
    );
  };

  aboutHandler = (msg) => {
    this.bot.sendMessage(
      msg.chat.id,
      `🏫 Hacker Embassy (Ереванский Хакспейс) - это пространство, где собираются единомышленники, увлеченные технологиями и творчеством. Мы вместе работаем над проектами, делимся идеями и знаниями, просто общаемся.
      
💻 Ты можешь почитать о нас подробнее на нашем сайте https://hackerembassy.site/
      
🍕 Мы всегда рады новым резидентам. Хочешь узнать, как стать участником? Жми команду /join`
    );
  };

  joinHandler = (msg) => {
    let message = TextGenerators.getJoinText();
    this.bot.sendMessage(msg.chat.id, message);
  };

  donateHandler = (msg) => {
    let accountants = UsersRepository.getUsersByRole("accountant");
    let message = TextGenerators.getDonateText(accountants, this.tag());
    this.bot.sendMessage(msg.chat.id, message);
  };

  locationHandler = (msg) => {
    let message = `🗺 Наш адрес: Армения, Ереван, Пушкина 38 (вход со двора)`;
    this.bot.sendMessage(msg.chat.id, message);
    this.bot.sendLocation(msg.chat.id, 40.18258, 44.51338);
    this.bot.sendPhoto(msg.chat.id, "./resources/images/house.jpg", {
      caption: `🏫 Вот этот домик, единственный в своем роде`,
    });
  };

  donateCoinHandler = async (msg, coinname) => {
    coinname = coinname.toLowerCase();
    let buffer = await CoinsHelper.getQR(coinname);
    let coin = CoinsHelper.getCoinDefinition(coinname);

    this.bot.sendPhoto(msg.chat.id, buffer, {
      caption: `🪙 Используй этот QR код или адрес ниже, чтобы задонатить нам в ${coin.fullname}.
      
⚠️ Обрати внимание, что сеть ${coin.network} и ты используешь правильный адрес:
\`${coin.address}\`
      
⚠️ Кошельки пока работают в тестовом режиме, прежде чем слать большую сумму, попробуй что-нибудь совсем маленькое или напиши бухгалтеру
      
💌 Не забудь написать бухгалтеру, что ты задонатил(ла/ло) и скинуть код транзакции или ссылку
в https://mempool.space/ или аналогичном сервисе
      
🛍 Если хочешь задонатить натурой (ohh my) или другим способом - жми /donate`,
      parse_mode: "Markdown",
    });
  };

  donateCardHandler = async (msg) => {
    let accountants = UsersRepository.getUsersByRole("accountant");
    let accountantsList = TextGenerators.getAccountsList(accountants, this.tag());

    this.bot.sendMessage(
      msg.chat.id,
`💌Для того, чтобы задонатить этим способом, напишите нашим бухгалтерам. Они подскажут вам текущие реквизиты или вы сможете договориться о времени и месте передачи. 
      
Вот они, слева-направо:
      ${accountantsList}
🛍 Если хочешь задонатить натурой или другим способом - жми /donate`
    );
  };
}

module.exports = BasicHandlers;
