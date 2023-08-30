import config from "config";

import { PrintersConfig } from "../config/schema";
import Donation from "../models/Donation";
import Fund from "../models/Fund";
import Need from "../models/Need";
import User from "../models/User";
import UserState from "../models/UserState";
import StatusRepository from "../repositories/statusRepository";
import usersRepository from "../repositories/usersRepository";
import { convertCurrency, formatValueForCurrency } from "../utils/currency";
import { convertMinutesToHours, DateBoundary, ElapsedTimeObject } from "../utils/date";
import t from "./localization";
import { formatUsername, getRoles } from "./usersHelper";

const printersConfig = config.get("printers") as PrintersConfig;

export async function createFundList(funds: Fund[], donations: Donation[], options = undefined, mode = { mention: false }) {
    const defaultOptions = { showAdmin: false, isApi: false, isHistory: false };
    options = { defaultOptions, ...options };

    let list = "";

    for (const fund of funds) {
        if (!fund) continue;

        const fundDonations = donations.filter(donation => {
            return donation.fund_id === fund.id;
        });
        const sumOfAllDonations = await fundDonations.reduce(async (prev, current) => {
            const newValue = await convertCurrency(current.value, current.currency, fund.target_currency);
            return (await prev) + newValue;
        }, Promise.resolve(0));
        const fundStatus = generateFundStatus(fund, sumOfAllDonations, options.isHistory);

        list += `${fundStatus} ${fund.name} - ${t("funds.fund.collected")} ${formatValueForCurrency(
            sumOfAllDonations,
            fund.target_currency
        )} ${t("funds.fund.from")} ${fund.target_value} ${fund.target_currency}\n`;

        if (!options.isHistory) list += generateDonationsList(fundDonations, options, mode);
        if (options.showAdmin) list += generateAdminFundHelp(fund, options.isHistory);

        list += "\n";
    }

    return list;
}

export function generateFundStatus(fund: Fund, sumOfAllDonations: number, isHistory: boolean) {
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

export function generateAdminFundHelp(fund: Fund, isHistory: boolean) {
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
    options: { showAdmin?: any; isApi?: any },
    mode: { mention: boolean }
) {
    let donationList = "";

    for (const donation of fundDonations) {
        donationList += `      ${options.showAdmin ? `[id:${donation.id}] - ` : ""}${formatUsername(
            donation.username,
            mode,
            options.isApi
        )} - ${formatValueForCurrency(donation.value, donation.currency)} ${donation.currency}${
            options.showAdmin && donation.accountant ? ` ➡️ ${formatUsername(donation.accountant, options.isApi)}` : ""
        }\n`;
    }

    return donationList;
}

export function getStatusMessage(
    state: { open: boolean; changedby: string },
    inside: UserState[],
    going: UserState[],
    climateInfo,
    mode,
    withSecrets = false,
    isApi = false
): string {
    const stateFullText = t("status.status.state", {
        stateEmoji: state.open ? "🔓" : "🔒",
        state: state.open ? t("status.status.opened") : t("status.status.closed"),
        stateMessage: state.open ? t("status.status.messageopened") : t("status.status.messageclosed"),
        changedBy: formatUsername(state.changedby, mode, isApi),
    });

    let insideText = inside.length > 0 ? t("status.status.insidechecked") : t("status.status.nooneinside") + "\n";
    for (const userStatus of inside) {
        insideText += `${formatUsername(userStatus.username, mode, isApi)} ${getUserBadgesWithStatus(userStatus)}\n`;
    }

    let goingText = going.length > 0 ? `\n${t("status.status.going")}` : "";
    for (const userStatus of going) {
        goingText += `${formatUsername(userStatus.username, mode, isApi)} ${getUserBadges(userStatus.username)} ${
            userStatus.note ? `(${userStatus.note})` : ""
        }\n`;
    }

    const climateText = climateInfo
        ? `\n${t("embassy.climate.data", { climateInfo })}${withSecrets ? t("embassy.climate.secretdata", { climateInfo }) : ""}`
        : "";

    const updateText = !isApi
        ? `⏱ ${t("status.status.updated")} ${new Date().toLocaleString("RU-ru").replace(",", " в").substring(0, 21)}\n`
        : "";

    return `${stateFullText}
${insideText}${goingText}${climateText}
${updateText}`;
}

export function getUserBadges(username: string): string {
    const user = usersRepository.getUserByName(username);
    if (!user) return "";

    const roles = getRoles(user);
    const roleBadges = `${roles.includes("member") ? "🔑" : ""}${roles.includes("accountant") ? "📒" : ""}`;
    const customBadge = user.emoji ?? "";

    return `${roleBadges}${customBadge}`;
}

export function getUserBadgesWithStatus(userStatus: UserState): string {
    const userBadges = getUserBadges(userStatus.username);
    const autoBadge = userStatus.type === StatusRepository.ChangeType.Auto ? "📲" : "";

    return `${autoBadge}${userBadges}`;
}

export function getAccountsList(accountants: User[], mode, isApi = false): string {
    return accountants
        ? accountants.reduce(
              (list, user) => `${list}${formatUsername(user.username, mode, isApi)} ${getUserBadges(user.username)}\n`,
              ""
          )
        : "";
}

export function getResidentsList(residents: User[], mode): string {
    let userList = "";
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

export function getNeedsList(needs: Need[], mode): string {
    let message = `${t("needs.buy.nothing")}\n`;

    if (needs.length > 0) {
        message = `${t("needs.buy.pleasebuy")}\n`;

        for (const need of needs) {
            message += `- #\`${need.text}#\` ${t("needs.buy.byrequest")} ${formatUsername(need.requester, mode)}\n`;
        }
    }

    message += `\n${t("needs.buy.helpbuy")}`;

    if (needs.length > 0) {
        message += t("needs.buy.helpbought");
    }

    return message;
}

export function getDonateText(accountants: User[], isApi: boolean = false): string {
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
        accountantsList: getAccountsList(accountants, isApi),
    });
}

export function getJoinText(isApi: boolean = false): string {
    return t("basic.join", {
        statusCommand: `${!isApi ? "/" : ""}status`,
        donateCommand: `${!isApi ? "/" : ""}donate`,
        locationCommand: `${!isApi ? "/" : ""}location`,
    });
}

export function getEventsText(isApi: boolean = false, calendarAppLink: string = undefined): string {
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

export function getBirthdaysList(birthdayUsers: User[], mode): string {
    let message = t("birthday.nextbirthdays");
    let usersList = `\n${t("birthday.noone")}\n`;

    if (birthdayUsers) {
        const usersWithBirthdayThisMonth = birthdayUsers
            .map(u => {
                const parts = u.birthday.split("-");
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

export async function getPrinterStatus(status: {
    print_stats: any;
    heater_bed: any;
    extruder: any;
    display_status: { progress: number };
}): Promise<string> {
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

        let medal;

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
