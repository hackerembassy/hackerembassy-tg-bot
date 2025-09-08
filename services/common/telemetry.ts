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

    public receivedCommandsCounter = new promClient.Counter({
        name: "received_commands_total",
        help: "Total number of received commands",
        labelNames: ["command"] as const,
    });

    public receivedCallbacksCounter = new promClient.Counter({
        name: "received_callbacks_total",
        help: "Total number of received callback queries",
        labelNames: ["command"] as const,
    });
}

export default new TelemetryService();
