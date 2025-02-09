import config from "config";
import fetch from "node-fetch";

import { alarm } from "@services/embassy/hass";
import logger from "@services/common/logger";
import { mqttSendOnce } from "@utils/network";

import { EmbassyApiConfig } from "@config";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");

export enum UnlockMethod {
    MQTT = "MQTT",
    HTTP = "HTTP",
}

class DoorLock {
    // Public methods
    public async unlock(method: UnlockMethod) {
        alarm.disarm().catch(error => logger.error("Failed to disarm the alarm", error));

        try {
            switch (method) {
                case UnlockMethod.MQTT:
                    await this.unlockByMqtt();
                    break;
                case UnlockMethod.HTTP:
                    await this.unlockByHttp();
                    break;
            }
            logger.info(`Door is opened using ${method}`);
        } catch (error) {
            logger.info("Failed to open the door", error);
            return false;
        }

        return true;
    }

    // Private methods
    private async unlockByHttp() {
        const response = await fetch(process.env["DOOR_ENDPOINT"] as string, {
            method: "POST",
            headers: {
                Authorization: `Basic ${process.env["DOOR_TOKEN"] as string}`,
            },
        });

        if (!response.ok) throw new Error("Failed to open the door", { cause: response.statusText });
    }

    private unlockByMqtt() {
        return mqttSendOnce(embassyApiConfig.mqtthost, "door", "1", process.env["MQTTUSER"], process.env["MQTTPASSWORD"]);
    }
}

export default new DoorLock();
