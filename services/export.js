const { writeToBuffer } = require("@fast-csv/format");
const FundsRepository = require("../repositories/fundsRepository");
const ChartJsImage = require("chartjs-to-image");
const Currency = require("../services/currency");

function getRandomColor() {
  let letters = "3456789AB";
  let color = "#";

  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 9)];
  }

  return color;
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

async function exportFundToCSV(fundname) {
  let fund = FundsRepository.getfundByName(fundname);
  let donations = FundsRepository.getDonationsForName(fundname);
  let fundDonations = await Promise.all(
    donations.map(async (d) => {
      let convertedValue = await Currency.convertCurrency(
        d.value,
        d.currency,
        fund.target_currency
      );
      return {
        username: d.username,
        donation: d.value,
        currency: d.currency,
        converted: convertedValue,
        target_currency: fund.target_currency,
      };
    })
  );

  return (csv = await writeToBuffer(fundDonations, { headers: true }));
}

async function exportFundToDonut(fundname) {
  let fund = FundsRepository.getfundByName(fundname);
  let alldonations = FundsRepository.getDonationsForName(fundname);
  let fundDonations = await Promise.all(
    alldonations.map(async (d) => {
      let convertedValue = await Currency.convertCurrency(
        d.value,
        d.currency,
        fund.target_currency
      );
      return {
        username: d.username,
        donation: Number(convertedValue.toFixed(2)),
        currency: fund.target_currency,
      };
    })
  );

  let labels = fundDonations.map((donation) => donation.username);
  let data = fundDonations.map((donation) => donation.donation);
  let sum = data.reduce((acc, val) => acc + val, 0);
  let target = fund.target_value;
  let remained = sum - target;
  let spread = colorScheme.length / labels.length;
  let customColorScheme = labels.map(
    (_, index) =>
      colorScheme[Math.floor(index * spread + spread / 2) % colorScheme.length]
  );

  if (remained < 0) {
    labels.push("Remained");
    data.push(remained);
    customColorScheme.push(remainedColor);
  }

  let chart = new ChartJsImage();

  chart.setConfig({
    type: "donut",
    data: {
      labels: labels,
      datasets: [
        { label: "Users", data: data, backgroundColor: customColorScheme },
      ],
    },
    options: {
      title: {
        display: true,
        text: fundname,
      },
      layout: {
        padding: {
          left: 100,
          right: 100,
          top: 0,
          bottom: 20,
        },
      },
      plugins: {
        datalabels: {
          color: "#fff",
          backgroundColor: "#888",
          borderRadius: 10,
          anchor: "end",
          align: "end",
          formatter: (val) => val,
          font: {
            size: 15,
          },
        },
        doughnutlabel: {
          labels: [
            { text: `${target} ${fund.target_currency}`, font: { size: 20 } },
            { text: "target" },
          ],
        },
      },
    },
  });
  chart.setWidth(600).setHeight(600).setBackgroundColor("transparent");

  return await chart.toBinary();
}

module.exports = { exportFundToCSV, exportFundToDonut };
