/* eslint-disable no-console */
import fundsRepository from "@repositories/funds";

function migrateDonations(from: string, to: string) {
    console.log("Migrating donations");
    console.log("=======================");
    if (!from || !to) {
        console.log("Please provide from and to usernames");
        return;
    }
    console.log("Migrating from: ", from);
    console.log("Migrating to: ", to);
    console.log("=======================");

    const donations = fundsRepository.getDonationsOf(from);

    if (!donations) {
        console.log(`No donations found for ${from}`);
        return;
    }

    for (const donation of donations) {
        fundsRepository.updateDonation({ ...donation, username: to });
        console.log(`Migrated donation ${donation.id} from ${from} to ${to}`);
    }
}

migrateDonations(process.argv[2], process.argv[3]);
