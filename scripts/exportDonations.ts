/* eslint-disable no-console */
import { promises as fs } from "fs";
import path from "path";

import fundsRepository from "@repositories/fundsRepository";

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

exportDonations();
