import config from "config";
import fetch from "node-fetch";

import { BotConfig } from "../config/schema";

const botConfig = config.get("bot") as BotConfig;
const calendarURL = new URL(botConfig.calendarUrl);
const calendarID: string = calendarURL.searchParams.get("src")!;

async function getEventsJSON(calendarID: string) {
    const apiKey = process.env["HACKERGOOGLEAPIKEY"];
    if (!apiKey) {
        throw Error("No Google API key is provided");
    }
    const result = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarID}/events?key=${apiKey}`, {
        method: "GET",
    });
    return result.json();
}

export async function getClosetsFiveEvents(eventsJson: JSON) {
    console.log(eventsJson);
}

export async function doTheJob() {
    const eventsJson = await getEventsJSON(calendarID);
    getClosetsFiveEvents(eventsJson);
}
