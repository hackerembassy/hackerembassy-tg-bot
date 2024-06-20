/* eslint-disable no-console */
import statusRepository from "@repositories/status";

function migrateUserStatuses(from: string, to: string) {
    console.log("Migrating user statuses usernames");
    console.log("=======================");
    if (!from || !to) {
        console.log("Please provide from and to usernames");
        return;
    }
    console.log("Migrating from: ", from);
    console.log("Migrating to: ", to);
    console.log("=======================");

    const userStates = statusRepository.getUserStates(from);

    for (const userState of userStates) {
        statusRepository.updateUserState({ ...userState, username: to });
        console.log(`Migrated user state ${userState.id} from ${from} to ${to}`);
    }
}

migrateUserStatuses(process.argv[2], process.argv[3]);
