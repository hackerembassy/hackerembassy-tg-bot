# Hacker Embassy Telegram Bot

[![Up](https://uptime.hackem.cc/api/badge/7/status)](<(https://uptime.hackem.cc/api/badge/7/status)>)
[![Ping](https://uptime.hackem.cc/api/badge/7/ping)](<(https://uptime.hackem.cc/api/badge/7/ping)>)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=hackerembassy_hackerembassy-tg-bot&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=hackerembassy_hackerembassy-tg-bot)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=hackerembassy_hackerembassy-tg-bot&metric=bugs)](https://sonarcloud.io/summary/new_code?id=hackerembassy_hackerembassy-tg-bot)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=hackerembassy_hackerembassy-tg-bot&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=hackerembassy_hackerembassy-tg-bot)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=hackerembassy_hackerembassy-tg-bot&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=hackerembassy_hackerembassy-tg-bot)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=hackerembassy_hackerembassy-tg-bot&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=hackerembassy_hackerembassy-tg-bot)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=hackerembassy_hackerembassy-tg-bot&metric=coverage)](https://sonarcloud.io/summary/new_code?id=hackerembassy_hackerembassy-tg-bot)

## About

This bot is built to handle various tasks related to managing our hackerspace. Its features include:

-   Providing information about the space, its residents, location, and how to donate
-   Managing arrivals, departures, and attendance of participants
-   Handling finances, including donations and generating financial reports, it also converts currencies (fiat and crypto)
-   Creating and maintaining a shopping list for the shared space
-   Managing users and roles within the space
-   Providing real-time status updates on the 3D printer, such as printing percent done, time left, temperatures, and material consumption
-   Access to security cameras
-   Reporting climate data for all floors of the space
-   Remote door lock access - if someone knocks when no one is around, the bot will alert the chat group and snap a photo
-   Offering an API for some commands for the space's website, Home Assistant, and SpaceApi
-   Quick inline response buttons
-   Automatically recording participant entry and exit via the wifi network
-   Keeping track of birthdays and automatically sending birthday congrats
-   Sending utilities and internet bill reminders
-   Sending random photos of cats, dogs, and Cab
-   The ability to send sounds and text messages to the speakers in the space
-   Generating space attendance stats with infographics
-   Waking up, shutting down and probing internal devices
-   Antispam in our public chats

An sqlite database is used to store data in the file ./data/db/data.db.
Test file with the correct schema ./data/sample.db.
To edit the database manually, I recommend https://sqlitebrowser.org/

User roles:

-   admin - manages users
-   accountant - manages donations and fees
-   member - a resident of the space, can open and close the space
-   trusted - a guest of the space, who has gained the resident's trust
-   default - regular guest, presence in the database is not required

## Hosting

The bot is hosted on a VPS located at gateway.hackerembassy.site. The service, embassy-api is hosted on the le-fail space computer by the window on the first floor and it helps bot to communicate with internal systems of the space, such as 3D printers, routers, cameras, doorbells, sensors, etc.. If you need any help with deployment, CI/CD or a test bot token, reach out to @tectonick and @Himura2la. You can also create your own test bot using the BotFather bot in Telegram.

## Dependencies

Node 18+
All main dependencies in the cloud and internal service are installed using npm i
[Deprecated] To convert the doorcam stream to jpg, you need to install ffmpeg on the bot service and add it to PATH.

## Local deployment:

1. Install nodejs version 18+
2. Go to the cloned repository folder
3. Install dependencies with the command
   npm install
4. Get a token for your test bot from the bot https://t.me/BotFather
5. Prepare the bot for the first launch (ssh-keygen must be added to PATH)
   npm run init-dev
6. Start the bot in automatic restart mode when the source code changes
   npm run dev - bot only
   npm run dev-service - service only
   npm run dev-both - bot and service at the same time
7. To run tests
   npm run test

## Main files

bot/core/HackerEmbassyBot.ts - class with extensions of the original tgbot library for additional functionality  
bot/init/instance.ts - initialization of a singleton for working with a bot  
bot/core/routes.ts - mapping text commands to their handlers  
bot/core/recurring-actions.ts - setting up actions that the bot performs automatically according to a timer  
bot/handlers/\*.ts - user command handlers

data/sample.db - base template for updating the schema (TODO proper migrations)  
data/db/data.db - main sqlite database (you can copy sample.db and rename it to data.db)
data/db.ts - service for working with the database

repositories - repositories on top of the database service  
resources - all sorts of additional resources, pictures, texts, etc.  
service - modules with functionality for various needs (communication via mqtt, receiving media, text generation, logging export, etc.)  
utils - common reusable utilities  
deploy - auxiliary files for deploying the bot and service  
scripts - scripts for automating some dev manipulations

app.ts - bot start file  
botApi.ts - node express service launched by a bot to communicate with it via the API  
embassyApi.ts - start file of the internal space service

## Environment variables needed

HACKERBOTTOKEN - Telegram API token  
UNLOCKKEY - Key for secure integrations between Bot and embassy API  
GUESTKEY - Key for trusted integrations
MQTTUSER - Broker username  
MQTTPASSWORD - Broker password  
WIFIUSER - Keenetic router username  
WIFIPASSWORD - Keenetic router user password  
UNIFIUSER - Unifi AP username  
UNIFIPASSWORD - Unifi AP password  
GAMINGUSER - Gaming server username  
GAMINGPASSWORD - Gaming server user password  
HASSTOKEN - Home Assistant API token  
HACKERGOOGLEAPIKEY - Google Calendar API token  
OPENAIAPIKEY - OpenAI API token  
SONAR_TOKEN - Sonar Cloud analysis token  

## Additional notes

To interact between the bot and the service, you will need to have "sec" folder with rsa keys in the pub.key and priv.key files.
Also, the UNLOCKKEY environment variable must be the same on the bot and on the service.
Check the port settings in the config folder.
For local development, it is better to create your own configuration in the config/local.json file
