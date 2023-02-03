const { Convert } = require("easy-currencies");
const CryptoConvert = require("crypto-convert").default;
const config = require('config');
const currencyConfig = config.get("currency");

const convert = new CryptoConvert({
	cryptoInterval: currencyConfig.cryptoUpdateInterval,
	fiatInterval: currencyConfig.fiatUpdateInterval,
	calculateAverage: true,
	binance: true,
});

(async function(){
	await convert.ready(); //Wait for the initial cache to load
	await convert.addCurrency("AMD","USD", async () => await Convert(1).from("AMD").to("USD"), currencyConfig.fiatUpdateInterval)
})();

async function convertCurrency(amount, from, to){
    try {
        await convert.ready();

        return await convert[from][to](amount);
    } catch (error) {
        return undefined;
    }
}

module.exports = {convertCurrency}