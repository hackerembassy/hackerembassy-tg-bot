import config from "config";
import { DateTime } from "luxon";
import fetch from "node-fetch";
import { RRuleSet, rrulestr } from "rrule";

import { BotConfig } from "../config/schema";

const botConfig = config.get("bot") as BotConfig;
const calendarURL = new URL(botConfig.calendarUrl);
const calendarID: string = calendarURL.searchParams.get("src")!;

type HSEvent = {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
};

function isHSEvent(event: any): event is HSEvent {
    return event.start instanceof Date && event.end instanceof Date;
}

type JsonDate = {
    dateTime: string;
    timeZone: string;
};

type HSEventFromJSON = {
    summary: string;
    description?: string;
    start: JsonDate;
    end: JsonDate;
    recurrence?: string[];
};

async function getEventsJSON(calendarID: string) {
    const apiKey = process.env["HACKERGOOGLEAPIKEY"];
    if (!apiKey) {
        throw Error("No Google API key is provided");
    }
    const result = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarID}/events?key=${apiKey}`, {
        method: "GET",
    });
    const json = result.json();
    if (!json) {
        throw Error("Something went wrong when fetching calendar from Google API");
    }
    return json;
}

function isHSEventFromJSON(event: any): event is HSEventFromJSON {
    return !(event.start instanceof Date) && !(event.end instanceof Date);
}

function printEvent<T extends { summary: string; description?: string }>(event: T) {
    console.log(`${event.summary}: `);
    if (isHSEvent(event)) {
        console.log(`${event.start} - ${event.end}\n`);
    }
    if (isHSEventFromJSON(event)) {
        console.log(`${event.start.dateTime} - ${event.end.dateTime}`);
    }
    if (!(typeof event.description === "undefined")) {
        console.log(`${event.description}`);
    }
}

function isRecurrenceFieldIllFormed(occurenceEventField: any) {
    return Array.isArray(occurenceEventField) && occurenceEventField.length > 1;
}

function extractICalDateFromExdate(exdateString: string): string | null {
    const until = "EXDATE;";
    const index = exdateString.indexOf(until);
    if (index === -1) {
        return null;
    }
    return exdateString.slice(index + until.length, exdateString.length);
}

function getAllEventOcurrencesFromEvent<T extends HSEventFromJSON>(event: T): Array<Date> {
    if (!event.recurrence) {
        return new Array(new Date(event.start.dateTime));
    }
    const rruleset: RRuleSet = new RRuleSet();
    const recurrenceRRuleStr = isRecurrenceFieldIllFormed(event.recurrence) ? event.recurrence?.[1] : event.recurrence?.[0];
    rruleset.rrule(
        rrulestr(recurrenceRRuleStr!, {
            dtstart: new Date(event.start.dateTime),
            cache: true,
        })
    );
    if (isRecurrenceFieldIllFormed(event.recurrence)) {
        const exdateStr = extractICalDateFromExdate(event.recurrence![0]);
        if (!exdateStr) {
            console.log(event.recurrence);
            throw Error("Incorrect RRule format in Calendar!");
        }
        const format = "'TZID='z':'yyyyMMdd'T'HHmmss";
        const exDateTime = DateTime.fromFormat(exdateStr, format);
        rruleset.exdate(exDateTime.toJSDate());
    }
    const timeInterval = new Date();
    timeInterval.setMonth(timeInterval.getMonth() + 3);
    return rruleset.between(new Date(), timeInterval);
}

function getEventsMap<T extends HSEventFromJSON, U extends { items: T[] }>(eventsJson: U): Map<number, HSEvent> {
    const eventsMap = new Map<number, HSEvent>();
    const currentDT = new Date();
    for (const event of eventsJson.items) {
        const startDT = new Date(event.start.dateTime);
        const endDT = new Date(event.end.dateTime);
        const eventDuration = endDT.valueOf() - startDT.valueOf();
        const ocurrencesDates = getAllEventOcurrencesFromEvent(event);
        for (const ocurrenceDate of ocurrencesDates) {
            const diff = ocurrenceDate.valueOf() - currentDT.valueOf();
            if (diff > 0) {
                const ocurrenceEndDT = new Date(ocurrenceDate.valueOf() + eventDuration);
                eventsMap.set(diff, {
                    summary: event.summary,
                    description: event.description,
                    start: ocurrenceDate,
                    end: ocurrenceEndDT,
                });
            }
        }
    }
    return new Map([...eventsMap].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
}

export async function doTheJob() {
    const eventsJson = await getEventsJSON(calendarID);
    try {
        const emap = getEventsMap(eventsJson);
        for (const [diff, event] of emap) {
            console.log(diff);
            printEvent(event);
        }
    } catch (error) {
        console.error(error);
    }
}
