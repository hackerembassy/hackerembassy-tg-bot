require("dotenv").config();

const mqtt = require("mqtt");
const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const mqtthost = embassyApiConfig.mqtthost;
const process = require("process");

/**
 * @returns {void}
 */
function unlock() {
    let client = mqtt.connect(`mqtt://${mqtthost}`, {
        username: process.env["MQTTUSER"],
        password: process.env["MQTTPASSWORD"],
    });
    client.on("connect", function () {
        client.subscribe("door", function (err) {
            if (!err) {
                client.publish("door", "1");
                client.end();
            } else {
                throw err;
            }
        });
    });
}

module.exports = { unlock };
