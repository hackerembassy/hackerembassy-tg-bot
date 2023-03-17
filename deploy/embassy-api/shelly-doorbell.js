let triggered = false;

Shelly.addEventHandler(function (e) {
    if (e.component === "input:0") {
        if (e.info.event === "single_push" && !triggered) {
            triggered = true;
            Shelly.call("Switch.set", { 'id': 0, 'on': true });

            Timer.set(220, false, function () {
                Shelly.call("Switch.set", { 'id': 0, 'on': false });
            }, null);

            Shelly.call(
                "HTTP.POST", {
                "url": "https://gateway.hackerembassy.site:9000/doorbell",
                "body": "{\"token\":\"VkVSWUJJR0RJQ0s=\"}"
            },
                function (result, err, message) {
                    Timer.set(10000, false, function () {
                        triggered = false;
                    }, null);
                }
            );
        }
    }
});