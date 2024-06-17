/* eslint-disable no-console */
import UserState from "@models/UserState";
import statusRepository from "@repositories/statusRepository";

function removeUserStateDuplicates() {
    const allUserStates = statusRepository.getAllUserStates();
    if (allUserStates.length === 0) {
        console.log("No user states found");
        return;
    }

    const allStates = allUserStates.sort((a, b) => (a.date > b.date ? 1 : -1));
    const allUniqueUsers = allStates.reduce((acc: string[], curr: UserState) => {
        if (!acc.includes(curr.username)) {
            acc.push(curr.username);
        }
        return acc;
    }, []);

    const statesToRemove = [];

    for (const username of allUniqueUsers) {
        const userStates = allStates.filter(state => state.username === username);
        let lastState = userStates[0];
        for (let i = 1; i < userStates.length; i++) {
            if (userStates[i].status === lastState.status) {
                statesToRemove.push(userStates[i]);
            } else {
                lastState = userStates[i];
            }
        }
    }

    for (const state of statesToRemove) {
        console.log(`Removing duplicate state at index ${state.id}`);
        statusRepository.removeUserState(state.id);
    }
}

removeUserStateDuplicates();
export default { removeUserStateDuplicates };
