async function createProjectList(projects, donations) {
  let list = "";

  for (const project of projects) {
    let projectDonations = donations.filter((donation) => {
      return donation.project_id === project.id;
    });

    let sum = projectDonations.reduce((prev, current) => {
      return prev.value ?? prev + current.value;
    }, 0);

    let statusEmoji = `⚙️[${project.status}]`;

    if (project.status === "closed") {
      statusEmoji = "☑️ [закрыт]";
    } else if (project.status === "postponed") {
      statusEmoji = "⏱ [отложен]";
    } else if (project.status === "open") {
      statusEmoji = sum < project.target_value ? "🟠" : "🟢";
    }

    list += `${statusEmoji} ${project.name} - Собрано ${sum} из ${project.target_value} ${project.target_currency}\n`;

    for (const donation of projectDonations) {
      list += `     [id:${donation.id}] - @${donation.username} - ${donation.value} ${donation.currency}\n`;
    }
  }

  return list;
}

module.exports = { createProjectList };
