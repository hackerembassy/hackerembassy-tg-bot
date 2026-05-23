/* eslint-disable no-console */
import { promises as fs } from "node:fs";
import path from "node:path";

import fundsRepository from "@repositories/funds";

async function exportDonations() {
    console.log("Extracting funds with donations");
    console.log("=======================");

    const csv = fundsRepository
        .exportDonations()
        .map(donation => {
            return `${donation.donationId},${donation.amount},${donation.currency},${donation.from},${donation.fund}`;
        })
        .join("\n");

    const filePath = path.join("export", "donations.csv");
    await fs.mkdir("export").catch(() => {});
    await fs.writeFile(filePath, csv);

    console.log(`Done, check ./${filePath}`);
}

void exportDonations();
