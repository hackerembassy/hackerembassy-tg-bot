const {tag} = require("../global");

function excapeUnderscore(text){
  return text.replace("_","\\_");
}

async function createFundList(funds, donations, addCommands = false) {
  let list = "";


  for (const fund of funds) {
    let fundDonations = donations.filter((donation) => {
      return donation.fund_id === fund.id;
    });

    let sum = fundDonations.reduce((prev, current) => {
      return prev.value ?? prev + current.value;
    }, 0);

    let statusEmoji = `⚙️[${fund.status}]`;

    if (fund.status === "closed") {
      statusEmoji = "☑️ \\[закрыт\]";
    } else if (fund.status === "postponed") {
      statusEmoji = "⏱ \\[отложен\]";
    } else if (fund.status === "open") {
      statusEmoji = sum < fund.target_value ? "🟠" : "🟢";
    }

    list += `${statusEmoji} \`${fund.name}\` - Собрано ${sum} из ${fund.target_value} ${fund.target_currency}\n`;

    for (const donation of fundDonations) {
      list += `     \\[id:${donation.id}\] - ${tag()}${excapeUnderscore(donation.username)} - ${donation.value} ${donation.currency}\n`;
    }
    if (addCommands){
      list += "\n";
      list += `\`/exportFund ${fund.name}\`\n`;
      list += `\`/exportDonut ${fund.name}\`\n`;
      list += `\`/addDonation 5000 from @username to ${fund.name}\`\n`;
      list += `\`/changeFundStatus of ${fund.name} to status_name\`\n`;
      list += `\`/removeDonation donation_id\`\n`;
      list += `\`/closeFund ${fund.name}\`\n`;
    }

    list+="\n";
  }

  return list;
}





function getAccountsList(accountants){
  let accountantsList = "";

  if (accountants !== null) {
    accountantsList = accountants.reduce(
      (list, user) => `${list}${tag()}${user.username}\n`,
      ""
    );
  }

  return accountantsList;
}

module.exports = { createFundList, getAccountsList };
