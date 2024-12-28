import { writeToBuffer } from "@fast-csv/format";
import ChartJsImage from "chartjs-to-image";

import config from "config";

import { BotConfig, SponsorshipLevelsConfig } from "@config";
import FundsRepository from "@repositories/funds";
import { compareMonthNames } from "@utils/date";
import { onlyUniqueInsFilter } from "@utils/filters";
import { equalsIns } from "@utils/text";
import { Donation, DonationEx, Fund, User } from "@data/models";
import { effectiveName } from "@hackembot/core/helpers";

import { DefaultCurrency, convertCurrency, formatValueForCurrency, sumDonations, toBasicMoneyString } from "./currency";
import { UserVisit } from "./status";

const fundsConfig = config.get<BotConfig>("bot").funds;

export enum SponsorshipLevel {
    Platinum = 4,
    Gold = 3,
    Silver = 2,
    Bronze = 1,
    None = 0,
}

export const SponsorshipNameToLevel = new Map<keyof SponsorshipLevelsConfig, SponsorshipLevel>([
    ["bronze", SponsorshipLevel.Bronze],
    ["silver", SponsorshipLevel.Silver],
    ["gold", SponsorshipLevel.Gold],
    ["platinum", SponsorshipLevel.Platinum],
]);

export const SponsorshipLevelToName = new Map<SponsorshipLevel, keyof SponsorshipLevelsConfig>([
    [SponsorshipLevel.Bronze, "bronze"],
    [SponsorshipLevel.Silver, "silver"],
    [SponsorshipLevel.Gold, "gold"],
    [SponsorshipLevel.Platinum, "platinum"],
]);

export const SponsorshipLevelToEmoji = new Map<SponsorshipLevel, string>([
    [SponsorshipLevel.Bronze, "🥉"],
    [SponsorshipLevel.Silver, "🥈"],
    [SponsorshipLevel.Gold, "🥇"],
    [SponsorshipLevel.Platinum, "💎"],
]);

interface SimplifiedDonation {
    username: string;
    donation: number;
}

type ChartLabel = {
    text: string;
    font: {
        size: number;
    };
};

const colorScheme = [
    "rgb(190, 30, 46)",
    "rgb(240, 65, 54)",
    "rgb(241, 90, 43)",
    "rgb(247, 148, 30)",
    "rgb(43, 56, 144)",
    "rgb(28, 117, 188)",
    "rgb(40, 170, 225)",
    "rgb(119, 179, 225)",
    "rgb(181, 212, 239)",
    "rgb(0, 104, 56)",
    "rgb(0, 148 ,69)",
    "rgb(57 ,181 ,74)",
    "rgb(141, 199, 63)",
    "rgb(215, 244, 34)",
    "rgb(249, 237, 50)",
    "rgb(248,241, 148)",
    "rgb(242,245, 205)",
    "rgb(123, 82, 49)",
    "rgb(104, 73, 158)",
    "rgb(102, 45, 145)",
    "rgb(148,149, 151)",
];

const remainedColor = "rgba(0,0,0,0.025)";

// Export functions

export async function exportFundToCSV(fundname: string): Promise<Buffer> {
    const fund = FundsRepository.getFundByName(fundname);
    if (!fund) throw Error("Fund not found");

    const donations = FundsRepository.getDonationsForFundId(fund.id, true, true);

    const DonationExs = await Promise.all(
        donations.map(async d => {
            const convertedValue = await convertCurrency(d.value, d.currency, fund.target_currency);
            return {
                username: d.user.username,
                donation: d.value,
                currency: d.currency,
                converted: convertedValue
                    ? formatValueForCurrency(convertedValue, fund.target_currency)
                    : "Error converting value",
                target_currency: fund.target_currency,
            };
        })
    );

    return await writeToBuffer(DonationExs, { headers: true });
}

export async function exportFundToDonut(fundname: string): Promise<Buffer> {
    const fund = FundsRepository.getFundByName(fundname);
    if (!fund) throw Error("Fund not found");

    const alldonations = FundsRepository.getDonationsForFundId(fund.id, true, true);
    const simplifiedDonations = await Promise.all(
        alldonations.map(async d => {
            const convertedValue = await convertCurrency(d.value, d.currency, fund.target_currency);
            return {
                username: d.user.username ?? d.user.first_name ?? "Unknown",
                donation: Number(convertedValue),
            };
        })
    );
    const combinedDonations = combineDonations(simplifiedDonations);

    const labels = combinedDonations.map(donation => donation.username);
    const values = combinedDonations.map(donation => donation.donation);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const data = values.map(d => formatValueForCurrency(d, fund.target_currency));
    const target = fund.target_value;
    const remained = formatValueForCurrency(sum - target, fund.target_currency);
    const spread = colorScheme.length / labels.length;
    const customColorScheme = labels.map((_, index) => colorScheme[Math.floor(index * spread + spread / 2) % colorScheme.length]);
    const donutLabels = [
        { text: `${toBasicMoneyString(target)} ${fund.target_currency}`, font: { size: 30 } },
        { text: "min", font: { size: 20 } },
    ];

    if (remained < 0) {
        labels.push("Remained");
        data.push(remained);
        customColorScheme.push(remainedColor);
    }

    const chart = createDonut(labels, data, fundname, { height: 900, width: 1400 }, donutLabels, customColorScheme);

    return await chart.toBinary();
}

export async function exportDonationsToLineChart(donations: DonationEx[], title: string): Promise<Buffer> {
    const monthLabels = donations.map(d => d.fund.name);

    // TODO add first_names handling
    const uniqueUsernames = donations
        .filter(d => d.user.username)
        .map(d => d.user.username as string)
        .filter(onlyUniqueInsFilter);

    const uniqueMonthLabels = monthLabels.filter(onlyUniqueInsFilter);
    const uniqueData = [];

    for (const username of uniqueUsernames) {
        const userDonations = donations.filter(d => equalsIns(d.user.username, username));
        const userData = [];

        for (const label of uniqueMonthLabels) {
            const labelDonations = userDonations.filter(d => equalsIns(d.fund.name, label));
            const convertedDonations = await Promise.all(
                labelDonations.map(async d => (await convertCurrency(d.value, d.currency)) ?? 0)
            );
            const labelDonationsSum = convertedDonations.reduce((acc, curr) => acc + curr, 0);
            userData.push(labelDonationsSum);
        }

        uniqueData.push({ label: username, data: userData });
    }

    const chart = createLines(uniqueMonthLabels, uniqueData, title, { height: 900, width: 1400 }, { y: DefaultCurrency });

    return await chart.toBinary();
}

// Chart generation functions

export async function createUserStatsDonut(userTimes: UserVisit[], title: string): Promise<Buffer> {
    return await createDonut(
        userTimes.map(ut => effectiveName(ut.user)) as string[],
        userTimes.map(ut => (ut.usertime.totalSeconds / 3600).toFixed(0)),
        title,
        { height: 1600, width: 2500 }
    ).toBinary();
}

export function createDonut(
    labels: string[],
    data: string[] | number[],
    titleText: string,
    params = { width: 1400, height: 900 },
    donutLabels: ChartLabel[] = [],
    customColorScheme: string[] | undefined = undefined
): ChartJsImage {
    const chart: ChartJsImage = new ChartJsImage();

    chart.setConfig({
        type: "donut",
        data: {
            labels: labels,
            datasets: [{ label: "Users", data: data, backgroundColor: customColorScheme }],
        },
        options: {
            legend: {
                position: "right",
                labels: { fontSize: 20 },
            },
            title: {
                display: true,
                text: titleText,
                padding: 40,
                align: "end",
                fontSize: 30,
            },
            layout: {
                padding: {
                    left: 10,
                    right: 10,
                    top: 0,
                    bottom: 50,
                },
            },
            plugins: {
                datalabels: {
                    color: "#fff",
                    backgroundColor: "#888",
                    borderRadius: 10,
                    anchor: "end",
                    align: "end",
                    display: "auto",
                    offset: 10,
                    formatter: (val: any) => val,
                    font: {
                        size: 15,
                    },
                },
                doughnutlabel: {
                    labels: donutLabels,
                },
            },
        },
    });
    chart.setWidth(params.width).setHeight(params.height).setBackgroundColor("transparent");

    return chart;
}

function createLines(
    labels: string[],
    data: { label: string; data: string[] | number[] }[],
    titleText: string,
    params = { width: 1400, height: 900 },
    axisLables: { x?: string; y?: string } = { x: undefined, y: undefined }
) {
    const chart: ChartJsImage = new ChartJsImage();

    chart.setConfig({
        type: "line",
        data: {
            labels: labels,
            datasets: data.map((d, index) => ({ label: d.label, data: d.data, borderColor: colorScheme[index], fill: false })),
        },
        options: {
            title: {
                display: true,
                text: titleText,
                padding: 40,
                align: "end",
                fontSize: 30,
            },
            scales: {
                xAxes: [
                    {
                        scaleLabel: {
                            display: axisLables.x !== undefined,
                            labelString: axisLables.x,
                        },
                    },
                ],
                yAxes: [
                    {
                        scaleLabel: {
                            display: axisLables.y !== undefined,
                            labelString: axisLables.y,
                        },
                        ticks: {
                            beginAtZero: true,
                        },
                    },
                ],
            },
        },
    });
    chart.setWidth(params.width).setHeight(params.height).setBackgroundColor("transparent");

    return chart;
}

// Helper functions for export
export function prepareCostsForExport(donations: DonationEx[], costsPrefix: string) {
    return donations
        .filter(d => d.fund.name.startsWith(costsPrefix))
        .map(d => {
            const dateString = d.fund.name.replace(costsPrefix, "").trim();
            const splitDate = dateString.split(" ");

            return {
                ...d,
                name: dateString,
                extractedMonthName: splitDate[0],
                extractedYear: Number(splitDate[1]),
            };
        })
        .sort((a, b) => compareMonthNames(a.extractedMonthName, b.extractedMonthName))
        .sort((a, b) => a.extractedYear - b.extractedYear);
}

export function combineDonations(donations: SimplifiedDonation[]): SimplifiedDonation[] {
    const uniqueUsernames = donations.map(d => d.username).filter(onlyUniqueInsFilter);
    const combinedDonations = [];

    for (const username of uniqueUsernames) {
        const userDonations = donations.filter(d => equalsIns(d.username, username));
        const userCombinedDonation = userDonations.reduce((acc, curr) => acc + curr.donation, 0);
        combinedDonations.push({ username, donation: userCombinedDonation });
    }

    return combinedDonations;
}

export async function getDonationsSummary(fund: Fund, limit?: number) {
    const donations = FundsRepository.getDonationsForFundId(fund.id, true, true) as (DonationEx & { converted_value?: number })[];

    for (const donation of donations) {
        donation.converted_value = (await convertCurrency(donation.value, donation.currency, fund.target_currency)) ?? -1;
    }

    // Add handling first_name
    const resultDonations = donations
        .toSorted((a, b) => b.converted_value! - a.converted_value!)
        .slice(0, limit)
        .map((d, index) => ({
            rank: index + 1,
            username: d.user.username ?? d.user.first_name ?? "Unknown",
            value: toBasicMoneyString(d.value),
            currency: d.currency,
            converted_value: d.converted_value,
            combined_value: `${toBasicMoneyString(d.value)} ${d.currency}`,
        }));

    // Processing data for HASS
    const collected_value = parseFloat(resultDonations.reduce((acc, d) => acc + (d.converted_value ?? 0), 0).toFixed(2));
    const ranked_donations = resultDonations.map(d => `${d.rank}. ${d.username} - ${d.combined_value}`).join("    ");
    const fund_stats = `${fund.name} - ${collected_value} out of ${fund.target_value} ${fund.target_currency}`;

    return {
        fund: {
            name: fund.name,
            target_value: toBasicMoneyString(fund.target_value),
            collected_value: toBasicMoneyString(collected_value),
            target_currency: fund.target_currency,
            status: fund.status,
        },
        donations: resultDonations,
        strings: {
            ranked_donations,
            fund_stats,
        },
    };
}

export function getUserDonationMap(donations: DonationEx[]) {
    const sponsorDataMap = new Map<number, { user: User; donations: Donation[] }>();

    for (const donation of donations) {
        let sponsorData = sponsorDataMap.get(donation.user_id);
        if (!sponsorData) {
            sponsorData = { user: donation.user, donations: [] };
            sponsorDataMap.set(donation.user_id, sponsorData);
        }
        sponsorData.donations.push(donation);
    }

    return sponsorDataMap.values();
}

export function getSponsorshipStartPeriodDate() {
    const startPeriodDate = new Date();
    startPeriodDate.setMonth(startPeriodDate.getMonth() - fundsConfig.sponsorship.period);
    return startPeriodDate;
}

export async function getSponsorshipLevel(donations: Donation[]) {
    const sum = await sumDonations(donations);
    return sum >= fundsConfig.sponsorship.levels.platinum
        ? SponsorshipLevel.Platinum
        : sum >= fundsConfig.sponsorship.levels.gold
          ? SponsorshipLevel.Gold
          : sum >= fundsConfig.sponsorship.levels.silver
            ? SponsorshipLevel.Silver
            : sum >= fundsConfig.sponsorship.levels.bronze
              ? SponsorshipLevel.Bronze
              : SponsorshipLevel.None;
}
