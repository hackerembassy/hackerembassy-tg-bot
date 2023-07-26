const { writeToBuffer } = require("@fast-csv/format");
const FundsRepository = require("../repositories/fundsRepository");
const ChartJsImage = require("chartjs-to-image");
const Currency = require("../utils/currency");
const t = require("./localization");

/**
 * @typedef {Object} SimplifiedDonation
 * @property {string} username
 * @property {number} donation
 */

/**
 * @typedef {import("../utils/date").DateBoundary} DateBoundary
 */

/**
 * @param {SimplifiedDonation[]} donations
 * @returns {SimplifiedDonation[]}
 */
function combineDonations(donations) {
    let uniqueUsernames = [...new Set(donations.map(d => d.username))];
    let combinedDonations = [];

    for (const username of uniqueUsernames) {
        let userDonations = donations.filter(d => d.username === username);
        let userCombinedDonation = userDonations.reduce((acc, curr) => acc + curr.donation, 0);
        combinedDonations.push({ username, donation: userCombinedDonation });
    }

    return combinedDonations;
}

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

/**
 * @param {string} fundname
 * @returns {Promise<Buffer>}
 */
async function exportFundToCSV(fundname) {
    let fund = FundsRepository.getFundByName(fundname);
    let donations = FundsRepository.getDonationsForName(fundname);
    let fundDonations = await Promise.all(
        donations.map(async d => {
            let convertedValue = await Currency.convertCurrency(d.value, d.currency, fund.target_currency);
            return {
                username: d.username,
                donation: d.value,
                currency: d.currency,
                converted: Currency.formatValueForCurrency(convertedValue, fund.target_currency),
                target_currency: fund.target_currency,
            };
        })
    );

    return await writeToBuffer(fundDonations, { headers: true });
}

/**
 * @param {string} fundname
 * @returns {Promise<Buffer>}
 */
async function exportFundToDonut(fundname) {
    let fund = FundsRepository.getFundByName(fundname);
    let alldonations = FundsRepository.getDonationsForName(fundname);

    let fundDonations = await Promise.all(
        alldonations.map(async d => {
            let convertedValue = await Currency.convertCurrency(d.value, d.currency, fund.target_currency);
            return {
                username: d.username,
                donation: Number(convertedValue),
            };
        })
    );

    fundDonations = combineDonations(fundDonations);

    let labels = fundDonations.map(donation => donation.username);
    let data = fundDonations.map(donation => donation.donation);
    let sum = data.reduce((acc, val) => acc + val, 0);
    data = data.map(d => Currency.formatValueForCurrency(d, fund.target_currency));
    let target = fund.target_value;
    let remained = Currency.formatValueForCurrency(sum - target, fund.target_currency);
    let spread = colorScheme.length / labels.length;
    let customColorScheme = labels.map((_, index) => colorScheme[Math.floor(index * spread + spread / 2) % colorScheme.length]);
    let donutLabels = [
        { text: `${target} ${fund.target_currency}`, font: { size: 30 } },
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

/**
 * @param {{username:string, usertime: {totalSeconds:number}}[]} userTimes
 * @param {DateBoundary} dateBoundaries
 * @returns {Promise<Buffer>}
 */
async function createUserStatsDonut(userTimes, dateBoundaries) {
    return await createDonut(
        userTimes.map(ut => ut.username),
        userTimes.map(ut => (ut.usertime.totalSeconds / 3600).toFixed(0)),
        `${t("status.stats.hoursinspace", dateBoundaries)}`,
        { height: 1200, width: 1600 }
    ).toBinary();
}

/**
 * @param {string[]} labels
 * @param {string[] | number[]} data
 * @param {string} titleText
 */
function createDonut(
    labels,
    data,
    titleText,
    params = { width: 1400, height: 900 },
    donutLabels = [],
    customColorScheme = undefined
) {
    let chart = new ChartJsImage();

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
                    formatter: val => val,
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

module.exports = { exportFundToCSV, exportFundToDonut, createDonut, createUserStatsDonut };
