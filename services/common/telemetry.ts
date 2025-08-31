import * as promClient from "prom-client";

class TelemetryService {
    public detectedDevicesGauge = new promClient.Gauge({
        name: "autoinside_detected_devices",
        help: "Number of devices inside",
    });

    public detectedUsersGauge = new promClient.Gauge({
        name: "autoinside_detected_users",
        help: "Number of users inside",
    });
}

export default new TelemetryService();
