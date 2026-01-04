import config from "config";
import fetch from "node-fetch";
import memoize from "memoizee";

import { getToday, MINUTE } from "@utils/date";
import { CalendarConfig } from "@config";

const calendarConfig = config.get<CalendarConfig>("calendar");

export const calendarUrl = calendarConfig.url;

const calendarID: string = new URL(calendarUrl).searchParams.get("src")!;

export type HSEvent = {
    summary: string;
    description?: string;
    start?: Date;
    end?: Date;
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
    const json = (await result.json()) as CalendarListResponse | undefined;
    if (!json) {
        throw Error("Something went wrong when fetching calendar from Google API");
    }
    return json;
}

export async function getClosestEventsFromCalendar(
    numberOfEvents: number = calendarConfig.defaultRequestAmount,
    from: Date = new Date()
): Promise<HSEvent[]> {
    const eventsJson = await getEventsJSON(calendarID, numberOfEvents, from);

    return eventsJson.items.map((event: HSEventFromJSON) => {
        const startString = event.start.dateTime ?? event.start.date;
        const endString = event.end.dateTime ?? event.end.date;

        return {
            summary: event.summary,
            description: event.description,
            allDay: !event.start.dateTime,
            start: startString ? new Date(startString) : undefined,
            end: endString ? new Date(endString) : undefined,
        };
    });
}

export async function getTodayEvents(): Promise<HSEvent[]> {
    const todayDate = getToday();
    const nowDate = new Date();
    const tomorrowDate = new Date(getToday().setDate(todayDate.getDate() + 1));
    const events = await getClosestEventsFromCalendar(calendarConfig.defaultRequestAmount, todayDate);

    return events.filter(e => e.start && e.start < tomorrowDate && e.end && e.end > nowDate);
}

export const getTodayEventsCached = memoize(getTodayEvents, { maxAge: MINUTE, promise: true });
