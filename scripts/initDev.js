const fs = require("fs");
const { execSync } = require("child_process");
// @ts-ignore
const readline = require("readline/promises");
const UsersRepository = require("../repositories/usersRepository").default;

(async function initScript() {
    console.log(
        "[DEV] Preparing bot before the first launch.\n ! You need to have ssh-keygen installed in PATH to succesfully generate keys for embassy API"
    );

    // Copy sample db
    if (!fs.existsSync("./data/db")) {
        fs.mkdirSync("./data/db", { recursive: true });
    }
    await fs.promises.copyFile("./data/sample.db", "./data/db/data.db");

    // Read dev telegram username
    const rl = readline.createInterface({
        input: globalThis.process.stdin,
        output: globalThis.process.stdout,
    });

    const devTgUsername = await rl.question("\nEnter your telegram username: ");

    if (!devTgUsername || devTgUsername.length === 0) {
        console.log("! Developer Username was not provided. You will need to add it to db manually to be an admin");
    } else {
        UsersRepository.addUser(devTgUsername, ["admin", "member", "accountant"]);
        console.log(`${devTgUsername} was added into db as admin`);
    }

    // Read telegram bot api token
    const tgBotApiToken = await rl.question("\nEnter your telegram api token from @BotFather: ");

    // Create .env file
    const envData = `HACKERBOTTOKEN="${tgBotApiToken}"
UNLOCKKEY="DevTestKey"
LUCITOKEN="replace_with_luci_token"
MQTTUSER="replace_with_mqtt_user"
MQTTPASSWORD="replace_with_mqtt_password"
WIFIUSER="replace_with_wifi_user"
WIFIPASSWORD="replace_with_wifi_password"
HASSTOKEN="replace_with_hass_token"
`;

    fs.writeFileSync(".env", envData);

    // Create config/sec directory
    if (!fs.existsSync("./config/sec")) {
        fs.mkdirSync("./config/sec", { recursive: true });
    }

    // Generate SSH key pair
    execSync("ssh-keygen -b 1024 -t rsa -f ./config/sec/priv.key -q -N '' -m pem <<< y");
    // Rename pub.key file
    fs.renameSync("./config/sec/priv.key.pub", "./config/sec/pub.key");

    // Success
    console.log("\nDone\n");
    console.log("! Don't forget to replace values in .env with actual tokens");
    console.log("To run the bot type 'npm run dev'");
    process.exit(0);
})();
