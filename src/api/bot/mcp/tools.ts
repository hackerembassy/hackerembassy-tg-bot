import config from "config";
import { z } from "zod";

import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";

import FundsRepository from "@data/repositories/funds";
import UsersRepository from "@data/repositories/users";

import { BotApiConfig } from "@config";
import { spaceService } from "@services/domain/space";
import { userService } from "@services/domain/user";
import { getFundDonationsSummary, SponsorshipLevel, SponsorshipLevelToName } from "@services/funds/export";
import { getClosestEventsFromCalendar, getTodayEventsCached } from "@services/external/googleCalendar";

const apiConfig = config.get<BotApiConfig>("api");

function jsonResult(data: unknown): CallToolResult {
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string): CallToolResult {
    return { content: [{ type: "text", text: message }], isError: true };
}

function effectiveName(person: { username?: string | null; first_name?: string | null }): string {
    return person.username ?? person.first_name ?? "Unknown";
}

export function registerMcpTools(server: McpServer): void {
    server.registerTool(
        "get_space_status",
        {
            description: "Get whether the Hacker Embassy hackerspace is currently open, and who is inside or planning to come",
        },
        () => {
            const state = spaceService.getState();
            const inside = userService.getPeopleInside();
            const going = userService.getPeopleGoing();

            return jsonResult({
                open: !!state.open,
                changedAt: new Date(state.date).toISOString(),
                changedBy: effectiveName(state.changer),
                peopleInside: inside.map(p => effectiveName(p.user)),
                peopleGoing: going.map(p => effectiveName(p.user)),
            });
        }
    );

    server.registerTool(
        "list_people_inside",
        { description: "List people currently inside the Hacker Embassy hackerspace, with the time they came in" },
        () => {
            const inside = userService.getPeopleInside();

            return jsonResult(
                inside.map(p => ({
                    name: effectiveName(p.user),
                    since: new Date(p.date).toISOString(),
                }))
            );
        }
    );

    server.registerTool(
        "get_donations",
        {
            description:
                "Get donation/payment summary for a fund. Call with no arguments to get the hackerspace's recurring " +
                "monthly rent fund, internally called 'costs' (e.g. fund name 'Аренда Декабрь 2025' - Russian for " +
                "'Rent'): who paid, how much, and progress toward the target for the current month. Pass a specific " +
                "fund name only if asked about a different, non-rent fund.",
            inputSchema: z.object({
                fund: z
                    .string()
                    .optional()
                    .describe(
                        "Specific fund name to look up. Omit this to get the current month's rent/costs fund - " +
                            "do not guess a costs fund name, leaving this unset already resolves to the latest one."
                    ),
                limit: z.number().int().positive().optional().describe("Limit on the number of donations returned"),
            }),
        },
        async ({ fund: fundName, limit }) => {
            const fund = fundName ? FundsRepository.getFundByName(fundName) : FundsRepository.getLatestCosts();

            if (!fund) return errorResult(`Fund not found${fundName ? `: ${fundName}` : ""}`);

            return jsonResult(await getFundDonationsSummary(fund, limit));
        }
    );

    server.registerTool("get_sponsors", { description: "List the Hacker Embassy's sponsors and their sponsorship level" }, () => {
        const sponsors = UsersRepository.getSponsors();

        return jsonResult(
            sponsors.map(s => ({
                name: effectiveName(s),
                sponsorship: SponsorshipLevelToName.get(s.sponsorship as SponsorshipLevel),
            }))
        );
    });

    if (apiConfig.features.calendar) {
        server.registerTool(
            "get_upcoming_events",
            {
                description: "Get the closest upcoming events on the Hacker Embassy calendar",
                inputSchema: z.object({
                    count: z.number().int().positive().optional().describe("Number of events to return"),
                }),
            },
            async ({ count }) => jsonResult(await getClosestEventsFromCalendar(count))
        );

        server.registerTool("get_today_events", { description: "Get events happening today at the Hacker Embassy" }, async () =>
            jsonResult(await getTodayEventsCached())
        );
    }
}
