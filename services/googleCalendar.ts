import config from "config";
import { DateTime } from "luxon";
import fetch from "node-fetch";
import { RRuleSet, rrulestr } from "rrule";

import { getToday } from "@utils/date";
import { CalendarConfig } from "@config";

import logger from "./logger";

const calendarConfig = config.get<CalendarConfig>("calendar");

export const calendarUrl = calendarConfig.url;

const calendarID: string = new URL(calendarUrl).searchParams.get("src")!;

export type HSEvent = {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    allDay: boolean;
};

type CalendarListResponse = { items: HSEventFromJSON[] };

type JsonDate = {
    dateTime?: string;
    date?: string;
    timeZone: string;
};

type HSEventFromJSON = {
    summary: string;
    description?: string;
    start: JsonDate;
    end: JsonDate;
    recurrence?: string[];
};

async function getEventsJSON(
    calendarID: string,
    numberOfEvents: number = 5,
    fromDate: Date = new Date(0)
): Promise<CalendarListResponse> {
    const apiKey = process.env["HACKERGOOGLEAPIKEY"];
    const dateMin = fromDate.toISOString();

    if (!apiKey) {
        throw Error("No Google API key is provided");
    }
    const result = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarID}/events?key=${apiKey}&maxResults=${numberOfEvents}&singleEvents=true&orderBy=startTime&timeMin=${dateMin}`,
        {
            method: "GET",
        }
    );
    const json = await result.json();
    if (!json) {
        throw Error("Something went wrong when fetching calendar from Google API");
    }
    return json;
}

// Recurrence field in Google calendar events is illformed if EXDATE is used and rrule can't parse it
/** @deprecated */
function isRecurrenceFieldIllFormed(occurenceEventField: any) {
    return Array.isArray(occurenceEventField) && occurenceEventField.length > 1;
}

// Had to write this function because Google Calendar returnes malformed answers
/** @deprecated */
function extractICalDateFromExdate(exdateString: string): string | null {
    const exdateToken = "EXDATE;";
    const index = exdateString.indexOf(exdateToken);

    if (index === -1) return null;

    return exdateString.slice(index + exdateToken.length, exdateString.length);
}

// And this one too
/** @deprecated */
function getAllEventOcurrencesFromEvent<T extends HSEventFromJSON>(event: T): Array<Date> {
    if (!event.recurrence) {
        return [new Date(event.start.dateTime ?? 0)];
    }

    const rruleset: RRuleSet = new RRuleSet();
    const recurrenceRRuleStr = isRecurrenceFieldIllFormed(event.recurrence) ? event.recurrence[1] : event.recurrence[0];
    rruleset.rrule(
        rrulestr(recurrenceRRuleStr, {
            dtstart: new Date(event.start.dateTime ?? 0),
            cache: true,
        })
    );

    if (isRecurrenceFieldIllFormed(event.recurrence)) {
        const exdateStr = extractICalDateFromExdate(event.recurrence[0]);
        if (!exdateStr) {
            logger.error(`Got unexpeted recurrence field: ${event.recurrence.toString()}`);
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

/** @deprecated */
// TODO: rewrite this
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getEventsMap(eventsJson: CalendarListResponse): Map<number, HSEvent> {
    const eventsMap = new Map<number, HSEvent>();
    const currentDate = new Date();

    for (const event of eventsJson.items) {
        const startDate = new Date(event.start.dateTime ?? event.start.date ?? 0);
        const endDate = new Date(event.end.dateTime ?? event.end.date ?? 0);
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
                    allDay: false,
                });
            }
        }
    }

    return eventsMap;
}

export async function getClosestEventsFromCalendar(
    numberOfEvents: number = calendarConfig.defaultRequestAmount,
    from: Date = new Date()
): Promise<HSEvent[]> {
    const eventsJson = await getEventsJSON(calendarID, numberOfEvents, from);

    return eventsJson.items.map((event: HSEventFromJSON) => ({
        summary: event.summary,
        description: event.description,
        allDay: !event.start.dateTime,
        start: new Date(event.start.dateTime ?? event.start.date ?? 0),
        end: new Date(event.end.dateTime ?? event.end.date ?? 0),
    }));
}

export async function getTodayEvents(): Promise<HSEvent[]> {
    const todayDate = getToday();
    const tomorrowDate = new Date(getToday().setDate(todayDate.getDate() + 1));
    const events = await getClosestEventsFromCalendar(calendarConfig.defaultRequestAmount, todayDate);

    return events.filter(e => e.start < tomorrowDate);
}
