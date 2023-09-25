import config from "config";
import { DateTime } from "luxon";
import fetch from "node-fetch";
import { RRuleSet, rrulestr } from "rrule";

import { BotConfig } from "../config/schema";
import logger from "./logger";

const botConfig = config.get("bot") as BotConfig;
const calendarURL = new URL(botConfig.calendarUrl);
const calendarID: string = calendarURL.searchParams.get("src")!;

export type HSEvent = {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
};

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
    const json = await result.json();
    if (!json) {
        throw Error("Something went wrong when fetching calendar from Google API");
    }
    return json;
}

// Recurrence field in Google calendar events is illformed if EXDATE is used and rrule can't parse it
function isRecurrenceFieldIllFormed(occurenceEventField: any) {
    return Array.isArray(occurenceEventField) && occurenceEventField.length > 1;
}

// Had to write this function because Google Calendar returnes malformed answers
function extractICalDateFromExdate(exdateString: string): string | null {
    const exdateToken = "EXDATE;";
    const index = exdateString.indexOf(exdateToken);

    if (index === -1) return null;

    return exdateString.slice(index + exdateToken.length, exdateString.length);
}

// And this one too
function getAllEventOcurrencesFromEvent<T extends HSEventFromJSON>(event: T): Array<Date> {
    if (!event.recurrence) {
        return [new Date(event.start.dateTime)];
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
            logger.error(`Got unexpeted recurrence field: ${event.recurrence}`);
            throw Error("Incorrect RRule format in Calendar!");
        }
        const exDateFormat = "'TZID='z':'yyyyMMdd'T'HHmmss";
        const exDateTime = DateTime.fromFormat(exdateStr, exDateFormat);
        rruleset.exdate(exDateTime.toJSDate());
    }

    const timeInterval = new Date();
    timeInterval.setMonth(timeInterval.getMonth() + 3);
    return rruleset.between(new Date(), timeInterval);
}

// TODO: rewrite this
function getEventsMap(eventsJson: { items: HSEventFromJSON[] }): Map<number, HSEvent> {
    const eventsMap = new Map<number, HSEvent>();
    const currentDate = new Date();

    for (const event of eventsJson.items) {
        const startDate = new Date(event.start.dateTime);
        const endDate = new Date(event.end.dateTime);
        const eventDuration = endDate.valueOf() - startDate.valueOf();
        const ocurrencesDates = getAllEventOcurrencesFromEvent(event);

        for (const ocurrenceDate of ocurrencesDates) {
            const diff = ocurrenceDate.valueOf() - currentDate.valueOf();

            if (diff > 0) {
                const ocurrenceEndDate = new Date(ocurrenceDate.valueOf() + eventDuration);

                eventsMap.set(diff, {
                    summary: event.summary,
                    description: event.description,
                    start: ocurrenceDate,
                    end: ocurrenceEndDate,
                });
            }
        }
    }

    return eventsMap;
}

export async function getNClosestEventsFromCalendar(numberOfEvents: number): Promise<Nullable<HSEvent[]>> {
    try {
        const eventsJson = await getEventsJSON(calendarID);

        return [...getEventsMap(eventsJson)]
            .sort((a, b) => a[0] - b[0])
            .slice(0, numberOfEvents)
            .map(a => a[1]);
    } catch (error) {
        logger.error(error);
        return null;
    }
}
