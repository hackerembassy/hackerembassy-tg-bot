const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const fetch = require("node-fetch");

class Cancellation {
  constructor(timeout = 15000){
    this.controller = new AbortController();
    this.timeoutId = setTimeout(() => this.controller.abort(), timeout);
  }

  get signal(){
    return this.controller.signal;
  }

  reset(){
    clearTimeout(this.timeoutId);
  }
}

function fetchWithTimeout(uri, options, ...rest){
  let cancellation = new Cancellation(embassyApiConfig.timeout);
  
  return fetch(uri, {signal:cancellation.signal, ...options}, ...rest);
}

module.exports = {fetchWithTimeout}