async function createFundList(funds, donations) {
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
      statusEmoji = "☑️ [закрыт]";
    } else if (fund.status === "postponed") {
      statusEmoji = "⏱ [отложен]";
    } else if (fund.status === "open") {
      statusEmoji = sum < fund.target_value ? "🟠" : "🟢";
    }

    list += `${statusEmoji} ${fund.name} - Собрано ${sum} из ${fund.target_value} ${fund.target_currency}\n`;

    for (const donation of fundDonations) {
      list += `     [id:${donation.id}] - @${donation.username} - ${donation.value} ${donation.currency}\n`;
    }
  }

  return list;
}

module.exports = { createFundList };
