const { Convert } = require("easy-currencies");
const CryptoConvert = require("crypto-convert").default;
const config = require('config');
const currencyConfig = config.get("currency");

const CurrencyFractionDigits = [
    {currency: "AMD", fraction: 0},
    {currency: "RUB", fraction: 0},
    {currency: "USD", fraction: 2},
    {currency: "USDT", fraction: 2},
    {currency: "USDC", fraction: 2},
    {currency: "EUR", fraction: 2},
    {currency: "BTC", fraction: 8},
    {currency: "ETH", fraction: 6},
  ]

function formatCurrency(value, currency) {
    let fraction = CurrencyFractionDigits.find(fd => fd.currency === currency)?.fraction ?? 4;
    return Number(value.toFixed(fraction));
}

function prepareCurrency(currencyInput){
    if (!currencyInput.length) 
      return currencyConfig.default;
  
    let outputCurrency = currencyInput;
  
    switch (currencyInput){
      case "$": outputCurrency = "USD"; break;
      case "€": outputCurrency = "EUR"; break;
      case "£": outputCurrency = "GBP"; break;
      case "֏": outputCurrency = "AMD"; break;
      case "₽": outputCurrency = "RUB"; break;
      default: outputCurrency = currencyInput.toUpperCase()
    }
  
    return outputCurrency;
  }

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

module.exports = {convertCurrency, CurrencyFractionDigits, formatCurrency, prepareCurrency}