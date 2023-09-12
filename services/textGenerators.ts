import config from "config";

import { PrintersConfig } from "../config/schema";
import Donation from "../models/Donation";
import Fund from "../models/Fund";
import Need from "../models/Need";
import User from "../models/User";
import UserState, { UserStateChangeType } from "../models/UserState";
import usersRepository from "../repositories/usersRepository";
import { convertCurrency, formatValueForCurrency } from "../utils/currency";
import { convertMinutesToHours, DateBoundary, ElapsedTimeObject } from "../utils/date";
import { SpaceClimate } from "./home";
import t from "./localization";
import { PrinterStatus } from "./printer3d";
import { formatUsername, getRoles } from "./usersHelper";

const printersConfig = config.get("printers") as PrintersConfig;

type FundListOptions = { showAdmin?: boolean; isHistory?: boolean; isApi?: boolean };

export async function createFundList(
    funds: Fund[] | null | undefined,
    donations: Donation[] | null,
    { showAdmin = false, isHistory = false, isApi = false }: FundListOptions,
    mode = { mention: false }
): Promise<string> {
    let list = "";

    if (!funds || funds.length === 0) {
        return list;
    }

    for (const fund of funds) {
        if (!fund) continue;

        const fundDonations =
            donations?.filter(donation => {
                return donation.fund_id === fund.id;
            }) ?? [];
        const sumOfAllDonations = await fundDonations.reduce(async (prev, current) => {
            const newValue = await convertCurrency(current.value, current.currency, fund.target_currency);
            const prevValue = await prev;

            return newValue ? prevValue + newValue : prevValue;
        }, Promise.resolve(0));
        const fundStatus = generateFundStatus(fund, sumOfAllDonations, isHistory);

        list += `${fundStatus} ${fund.name} - ${t("funds.fund.collected")} ${formatValueForCurrency(
            sumOfAllDonations,
            fund.target_currency
        )} ${t("funds.fund.from")} ${fund.target_value} ${fund.target_currency}\n`;

        if (!isHistory) list += generateDonationsList(fundDonations, { showAdmin, isApi }, mode);
        if (showAdmin) list += generateAdminFundHelp(fund, isHistory);

        list += "\n";
    }

    return list;
}

export function generateFundStatus(fund: Fund, sumOfAllDonations: number, isHistory: boolean): string {
    switch (fund.status) {
        case "closed":
            return `☑️ \\[${t("funds.fund.closed")}]`;
        case "postponed":
            return `⏱ \\[${t("funds.fund.postponed")}]`;
        case "open":
            return `${sumOfAllDonations < fund.target_value ? "🟠" : "🟢"}${isHistory ? ` \\[${t("funds.fund.open")}]` : ""}`;
        default:
            return `⚙️ \\[${fund.status}]`;
    }
}

export function generateAdminFundHelp(fund: Fund, isHistory: boolean): string {
    let helpList = `${isHistory ? "" : "\n"}#\`/fund ${fund.name}#\`\n`;

    if (!isHistory) {
        helpList += `#\`/exportfund ${fund.name}#\`
#\`/exportdonut ${fund.name}#\`
#\`/updatefund ${fund.name} with target 10000 AMD as ${fund.name}#\`
#\`/changefundstatus of ${fund.name} to status_name#\`
#\`/closefund ${fund.name}#\`
#\`/transferdonation donation_id to username#\`
#\`/adddonation 5000 AMD from @username to ${fund.name}#\`
#\`/changedonation donation_id to 5000 AMD#\`
#\`/removedonation donation_id#\`
`;
    }

    return helpList;
}

export function generateDonationsList(
    fundDonations: Donation[],
    options: { showAdmin?: boolean; isApi?: boolean },
    mode: { mention: boolean }
): string {
    let donationList = "";

    for (const donation of fundDonations) {
        donationList += `      ${options.showAdmin ? `[id:${donation.id}] - ` : ""}${formatUsername(
            donation.username,
            mode,
            options.isApi
        )} - ${formatValueForCurrency(donation.value, donation.currency)} ${donation.currency}${
            options.showAdmin && donation.accountant ? ` ➡️ ${formatUsername(donation.accountant, mode, options.isApi)}` : ""
        }\n`;
    }

    return donationList;
}

export function getStatusMessage(
    state: { open: boolean; changedby: string },
    inside: UserState[],
    going: UserState[],
    climateInfo: SpaceClimate | null,
    mode: { mention: boolean; short?: boolean },
    withSecrets = false,
    isApi = false
): string {
    const stateFullText = t(mode.short ? "status.status.state_short" : "status.status.state", {
        stateEmoji: state.open ? "🔓" : "🔒",
        state: state.open ? t("status.status.opened") : t("status.status.closed"),
        stateMessage: state.open ? t("status.status.messageopened") : t("status.status.messageclosed"),
        changedBy: formatUsername(state.changedby, mode, isApi),
    });

    let insideText =
        inside.length > 0
            ? t(mode.short ? "status.status.insidechecked_short" : "status.status.insidechecked", { count: inside.length })
            : t(mode.short ? "status.status.nooneinside_short" : "status.status.nooneinside") + (mode.short ? "" : "\n");
    for (const userStatus of inside) {
        insideText += `${formatUsername(userStatus.username, mode, isApi)} ${getUserBadgesWithStatus(userStatus)}${
            mode.short ? " " : "\n"
        }`;
    }

    let goingText =
        going.length > 0
            ? `\n${t(mode.short ? "status.status.going_short" : "status.status.going", { count: going.length })}`
            : "";
    for (const userStatus of going) {
        goingText += `${formatUsername(userStatus.username, mode, isApi)} ${getUserBadges(userStatus.username)} ${
            !mode.short && userStatus.note ? `(${userStatus.note})` : ""
        }${mode.short ? " " : "\n"}`;
    }

    const climateText = climateInfo
        ? `\n${t("embassy.climate.data", { climateInfo })}${withSecrets ? t("embassy.climate.secretdata", { climateInfo }) : ""}`
        : "";

    const updateText = !isApi
        ? `⏱ ${mode.short ? "" : t("status.status.updated")} ${new Date()
              .toLocaleString("RU-ru")
              .replace(",", " в")
              .substring(0, 21)}\n`
        : "";

    return `${stateFullText}\n${insideText}${goingText}${climateText}
${updateText}`;
}

export function getUserBadges(username: string | null): string {
    if (!username) return "";

    const user = usersRepository.getUserByName(username);
    if (!user) return "";

    const roles = getRoles(user);
    const roleBadges = `${roles.includes("member") ? "🔑" : ""}${roles.includes("accountant") ? "📒" : ""}`;
    const customBadge = user.emoji ?? "";

    return `${roleBadges}${customBadge}`;
}

export function getUserBadgesWithStatus(userStatus: UserState): string {
    const userBadges = getUserBadges(userStatus.username);
    const autoBadge = userStatus.type === UserStateChangeType.Auto ? "📲" : "";

    return `${autoBadge}${userBadges}`;
}

export function getAccountsList(accountants: User[] | undefined | null, mode: { mention: boolean }, isApi = false): string {
    return accountants
        ? accountants.reduce(
              (list, user) => `${list}${formatUsername(user.username, mode, isApi)} ${getUserBadges(user.username)}\n`,
              ""
          )
        : "";
}

export function getResidentsList(residents: User[] | undefined | null, mode: { mention: boolean }): string {
    let userList = "";

    if (!residents) return userList;

    for (const user of residents) {
        userList += `${formatUsername(user.username, mode)} ${getUserBadges(user.username)}\n`;
    }

    return t("basic.residents", { userList });
}

export function getMonitorMessagesList(monitorMessages: { level: string; message: string; timestamp: string }[]): string {
    return monitorMessages
        ? monitorMessages
              .map(message => `${message.level === "error" ? "⛔" : "⏺"} ${message.message} - ${message.timestamp}`)
              .join("\n")
        : "";
}

export function getNeedsList(needs: Need[] | null, mode: { mention: boolean }): string {
    let message = `${t("needs.buy.nothing")}\n`;
    const areNeedsProvided = needs && needs.length > 0;

    if (areNeedsProvided) {
        message = `${t("needs.buy.pleasebuy")}\n`;

        for (const need of needs) {
            message += `- #\`${need.text}#\` ${t("needs.buy.byrequest")} ${formatUsername(need.requester, mode)}\n`;
        }
    }

    message += `\n${t("needs.buy.helpbuy")}`;

    if (areNeedsProvided) message += t("needs.buy.helpbought");

    return message;
}

export function getDonateText(accountants: User[] | null, isApi: boolean = false): string {
    const cryptoCommands = !isApi
        ? `#\`/donatecrypto btc#\`
  #\`/donatecrypto eth#\`
  #\`/donatecrypto usdc#\`
  #\`/donatecrypto usdt#\``
        : "";

    return t("basic.donate", {
        donateCashCommand: !isApi ? "/donatecash" : "",
        donateCardCommand: !isApi ? "/donatecard" : "",
        fundsCommand: !isApi ? "/funds" : "funds",
        cryptoCommands,
        accountantsList: accountants ? getAccountsList(accountants, { mention: false }, isApi) : "",
    });
}

export function getJoinText(isApi: boolean = false): string {
    return t("basic.join", {
        statusCommand: `${!isApi ? "/" : ""}status`,
        donateCommand: `${!isApi ? "/" : ""}donate`,
        locationCommand: `${!isApi ? "/" : ""}location`,
    });
}

export function getEventsText(isApi: boolean = false, calendarAppLink: string | undefined = undefined): string {
    return t("basic.events.text", {
        calendarLink: isApi
            ? "<a href='https://calendar.google.com/calendar/embed?src=9cdc565d78854a899cbbc7cb6dfcb8fa411001437ae0f66bce0a82b5e7679d5e%40group.calendar.google.com&ctz=Asia%2FYerevan'>Hacker Embassy Public Events</a>"
            : "#[Hacker Embassy Public Events#]#(https://calendar.google.com/calendar/embed?src=9cdc565d78854a899cbbc7cb6dfcb8fa411001437ae0f66bce0a82b5e7679d5e%40group.calendar.google.com&ctz=Asia%2FYerevan#)",
        iCalLink: isApi
            ? "<a href='https://calendar.google.com/calendar/ical/9cdc565d78854a899cbbc7cb6dfcb8fa411001437ae0f66bce0a82b5e7679d5e@group.calendar.google.com/public/basic.ics'>iCal</a>"
            : "#[iCal#]#(https://calendar.google.com/calendar/ical/9cdc565d78854a899cbbc7cb6dfcb8fa411001437ae0f66bce0a82b5e7679d5e@group.calendar.google.com/public/basic.ics#)",
        donateCommand: `${!isApi ? "/" : ""}donate`,
        openCalendarInTelegram: !isApi && calendarAppLink ? `#[Open in Telegram#]#(${calendarAppLink}#)` : "",
    });
}

const shortMonthNames: string[] = [
    "birthday.months.january",
    "birthday.months.february",
    "birthday.months.march",
    "birthday.months.april",
    "birthday.months.may",
    "birthday.months.june",
    "birthday.months.july",
    "birthday.months.august",
    "birthday.months.september",
    "birthday.months.october",
    "birthday.months.october",
    "birthday.months.november",
    "birthday.months.december",
];

export function getBirthdaysList(birthdayUsers: User[] | null | undefined, mode: { mention: boolean }): string {
    let message = t("birthday.nextbirthdays");
    let usersList = `\n${t("birthday.noone")}\n`;

    if (birthdayUsers) {
        const usersWithBirthdayThisMonth = birthdayUsers
            .filter(u => u.birthday !== null)
            .map(u => {
                const parts = (u.birthday as string).split("-");
                return {
                    day: Number(parts[2]),
                    month: Number(parts[1]),
                    ...u,
                };
            })
            .filter(u => {
                return u.month === new Date().getMonth() + 1;
            })
            .sort((u1, u2) => u1.day - u2.day);

        if (usersWithBirthdayThisMonth.length > 0) {
            usersList = "";
            for (const user of usersWithBirthdayThisMonth) {
                message += `${user.day} ${t(shortMonthNames[user.month - 1])} - ${formatUsername(user.username, mode)}\n`;
            }
        }
    }

    return message + t("birthday.help", { usersList });
}

export function getPrintersInfo(): string {
    return t("embassy.printers.help", { anetteApi: printersConfig.anette.apibase, plumbusApi: printersConfig.plumbus.apibase });
}

export async function getPrinterStatusText(status: PrinterStatus): Promise<string> {
    const print_stats = status.print_stats;
    const state = print_stats.state;
    const heater_bed = status.heater_bed;
    const extruder = status.extruder;

    let message = t("embassy.printerstatus.statusheader", { state });

    if (state === "printing") {
        const progress = status.display_status.progress * 100;
        const minutesPast = print_stats.total_duration / 60;
        const minutesEstimate = (minutesPast / progress) * (100 - progress);

        message = t("embassy.printerstatus.status", {
            print_stats,
            extruder,
            heater_bed,
            past: convertMinutesToHours(minutesPast) ?? t("embassy.printerstatus.undefinedtime"),
            estimate: convertMinutesToHours(minutesEstimate) ?? t("embassy.printerstatus.undefinedtime"),
            progress: progress.toFixed(0),
            usedFilament: (print_stats.filament_used / 1000).toFixed(3),
        });
    }

    return message;
}

export function getStatsText(
    userTimes: { usertime: ElapsedTimeObject; username: string }[],
    dateBoundaries: DateBoundary,
    shouldMentionPeriod = false
) {
    let stats = `${shouldMentionPeriod ? t("status.stats.period", dateBoundaries) : t("status.stats.start")}:\n\n`;

    for (let i = 0; i < userTimes.length; i++) {
        const userTime = userTimes[i];

        let medal: string;

        switch (i + 1) {
            case 1:
                medal = "🥇";
                break;
            case 2:
                medal = "🥈";
                break;
            case 3:
                medal = "🥉";
                break;
            default:
                medal = i < 10 ? "🧁" : i === userTimes.length - 1 ? "🍆" : "🍪";
                break;
        }

        const place = `${medal}${i + 1}`.padEnd(4, " ");
        stats += `#\`#\`#\` ${place}${fixedWidthPeriod(userTime.usertime)}#\`#\`#\`   ${userTime.username} ${getUserBadges(
            userTime.username
        )}\n`;
    }

    stats += `\n${t("status.stats.tryautoinside")}`;
    stats += `\n${t("status.stats.help")}`;

    return stats;
}

export function fixedWidthPeriod(usertime: ElapsedTimeObject) {
    const days = `${usertime.days}d`.padStart(4, " ");
    const hours = `${usertime.hours}h`.padStart(3, " ");
    const minutes = `${usertime.minutes}m`.padStart(3, " ");
    return `${days} ${hours} ${minutes}`;
}
