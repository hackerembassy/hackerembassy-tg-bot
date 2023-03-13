require("dotenv").config();

const mqtt = require('mqtt');
const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const mqtthost = embassyApiConfig.mqtthost;

function unlock(){
    let client  = mqtt.connect(`mqtt://${mqtthost}`,{
        username: process.env["MQTTUSER"],
        password: process.env["MQTTPASSWORD"]
    })
    client.on('connect', function () {
        client.subscribe('door', function (err) {
          if (!err) {
            client.publish('door', '1');
            client.end();
          } else {
            console.log(err);
          }
        });
      });
}

// unlock();

module.exports = {unlock}