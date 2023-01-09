const { Convert } = require("easy-currencies");
const CryptoConvert = require("crypto-convert").default;
const convert = new CryptoConvert({
	cryptoInterval: 50000, //Crypto prices update interval in ms (default 5 seconds on Node.js & 15 seconds on Browsers)
	fiatInterval: (60 * 1e3 * 60), //Fiat prices update interval (default every 1 hour)
	calculateAverage: true, //Calculate the average crypto price from exchanges
	binance: true, //Use binance rates
});

(async function(){
	await convert.ready(); //Wait for the initial cache to load
	await convert.addCurrency("AMD","USD", async ()=>{
        let rate = await Convert(1).from("AMD").to("USD");
        return rate;
    }, 50000)
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