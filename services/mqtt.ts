import config from "config";
import { config as envconfig } from "dotenv";
envconfig();
import { connect } from "mqtt";
import { env } from "process";

import { EmbassyApiConfig } from "../config/schema";
const embassyApiConfig = config.get("embassy-api") as EmbassyApiConfig;
const mqtthost = embassyApiConfig.mqtthost;

export function unlock(): void {
    const client = connect(`mqtt://${mqtthost}`, {
        username: env["MQTTUSER"],
        password: env["MQTTPASSWORD"],
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
