import statusRepository from "../repositories/statusRepository";

function migrateUserStatuses(from, to) {
    console.log("Migrating user statuses usernames");
    console.log("=======================");
    if (!from || !to) {
        console.log("Please provide from and to usernames");
        return;
    }
    console.log("Migrating from: ", from);
    console.log("Migrating to: ", to);
    console.log("=======================");

    const userStatuses = statusRepository.getUserStates(from);
    for (const userStatus of userStatuses) {
        statusRepository.updateUserState({ ...userStatus, username: to });
        console.log(`Migrated user status ${userStatus.id} from ${from} to ${to}`);
    }

    const userStates = statusRepository.getUserStates(from);

    for (const userState of userStates) {
        statusRepository.updateUserState({ username: to, ...userState });
        console.log(`Migrated user state ${userState.id} from ${from} to ${to}`);
    }
}

migrateUserStatuses(process.argv[2], process.argv[3]);
