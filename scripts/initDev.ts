/* eslint-disable no-console */
import { execSync } from "child_process";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "fs";
import { createInterface } from "readline/promises";

import { getOrCreateDb } from "@data/scripts";

(async function initScript() {
    console.log(
        "[DEV] Preparing bot before the first launch.\n ! You need to have ssh-keygen installed in PATH to succesfully generate keys for embassy API"
    );

    getOrCreateDb(true);

    const UsersRepository = (await import("@repositories/users")).default;

    // Read dev telegram username
    const rl = createInterface({
        input: globalThis.process.stdin,
        output: globalThis.process.stdout,
    });

    const devTgUsername = await rl.question("\nEnter your telegram username: ");
    const devTgUserId = Number(await rl.question("\nEnter your telegram userid: "));

    if (!devTgUsername || devTgUsername.length === 0) {
        console.log("! Developer Username was not provided. You will need to add it to db manually to be an admin");
    } else if (!devTgUserId || isNaN(devTgUserId)) {
        console.log("! Developer UserId was not provided. You will need to add it to db manually to be an admin");
    } else {
        UsersRepository.addUser(devTgUserId, devTgUsername, ["admin", "member", "accountant"]);
        console.log(`${devTgUsername} was added into db as admin`);
    }

    // Read telegram bot api token
    const tgBotApiToken = await rl.question("\nEnter your telegram api token from @BotFather: ");

    // Create .env file
    const envData = `HACKERBOTTOKEN="${tgBotApiToken}"
    LUCITOKEN="_"
    UNLOCKKEY="_"
    MQTTUSER="_"
    MQTTPASSWORD="_"
    WIFIUSER="_"
    WIFIPASSWORD="_"
    GAMINGUSER="_"
    GAMINGPASSWORD="_"
    SONAR_TOKEN="_"
    HASSTOKEN="_"
    HACKERGOOGLEAPIKEY="_"
    OPENAIAPIKEY="_"
    OLLAMAAPIKEY="_"
    WIKIAPIKEY="_"
    OUTLINE_SIGNING_SECRET="_"
    UNIFIUSER="_"
    UNIFIPASSWORD="_"
    ALARMCODE="_"
    DOOR_ENDPOINT="_"
    DOOR_TOKEN="_"
    `;

    writeFileSync(".env", envData);

    // Create config/sec directory
    if (!existsSync("./config/sec")) {
        mkdirSync("./config/sec", { recursive: true });
    }

    // Generate SSH key pair
    execSync("ssh-keygen -b 1024 -t rsa -f ./config/sec/priv.key -q -N '' -m pem <<< y");
    // Rename pub.key file
    renameSync("./config/sec/priv.key.pub", "./config/sec/pub.key");

    // Success
    console.log("\nDone\n");
    console.log("! Don't forget to replace values in .env with actual tokens");
    console.log("To run the bot type 'npm run dev'");
    process.exit(0);
})();
