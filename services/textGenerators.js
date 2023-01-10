const Currency = require("../services/currency");

function excapeUnderscore(text){
  return text.replaceAll("_","\\_");
}

async function createFundList(funds, donations, addCommands = false, tag = "") {
  let list = "";

  for (const fund of funds) {
    if (!fund)
      continue;

    let fundDonations = donations.filter((donation) => {
      return donation.fund_id === fund.id;
    });

    let sum = await fundDonations.reduce(async (prev, current) => {
      let newValue = await Currency.convertCurrency(current.value, current.currency, fund.target_currency);
      return await prev + newValue;
    }, 0);

    let statusEmoji = `⚙️[${fund.status}]`;

    if (fund.status === "closed") {
      statusEmoji = "☑️ \\[закрыт\]";
    } else if (fund.status === "postponed") {
      statusEmoji = "⏱ \\[отложен\]";
    } else if (fund.status === "open") {
      statusEmoji = sum < fund.target_value ? "🟠" : "🟢";
    }

    list += `${statusEmoji} \`${fund.name}\` - Собрано ${sum.toFixed(2)} из ${fund.target_value} ${fund.target_currency}\n`;

    for (const donation of fundDonations) {
      list += `     \\[id:${donation.id}\] - ${tag}${excapeUnderscore(donation.username)} - ${donation.value} ${donation.currency}\n`;
    }
    if (addCommands){
      list += "\n";
      list += `\`/fund ${fund.name}\`\n`;
      list += `\`/exportFund ${fund.name}\`\n`;
      list += `\`/exportDonut ${fund.name}\`\n`;
      list += `\`/changeFundStatus of ${fund.name} to status_name\`\n`;
      list += `\`/closeFund ${fund.name}\`\n`;
      list += `\`/addDonation 5000 AMD from @username to ${fund.name}\`\n`;
      list += `\`/removeDonation donation_id\`\n`;
    }

    list+="\n";
  }

  return list;
}





function getAccountsList(accountants, tag){
  let accountantsList = "";

  if (accountants !== null) {
    accountantsList = accountants.reduce(
      (list, user) => `${list}${tag}${user.username}\n`,
      ""
    );
  }

  return accountantsList;
}

module.exports = { createFundList, getAccountsList };
