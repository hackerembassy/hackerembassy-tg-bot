/* eslint-disable no-console */
import fs from "fs";

import usersRepository from "../repositories/usersRepository";

function importUsers(fromFile: string) {
    console.log("Importing users from: ", fromFile);
    console.log("=======================");
    if (!fromFile) {
        console.log("Please provide a file to import from");
        return;
    }

    const dbUsers = usersRepository.getUsers();
    const fileUsers = JSON.parse(fs.readFileSync(fromFile).toString()) as { id: number; username: string }[] | undefined;

    if (!dbUsers || !fileUsers) {
        console.log("No users found");
        return;
    }

    let usersCreatedCount = 0;
    let usersUpdatedCount = 0;

    for (const fuser of fileUsers) {
        const existingUser = dbUsers.find(u => u.username === fuser.username);
        if (existingUser) {
            usersUpdatedCount++;
            console.log(`! User ${existingUser.username} exists, updating userid from ${existingUser.userid} to ${fuser.id}`);

            usersRepository.updateUser({ ...existingUser, userid: fuser.id });
        } else {
            usersRepository.addUser(fuser.username, ["default"], fuser.id);
            usersCreatedCount++;
            console.log(
                `+ User ${fuser.username} does not exist, adding user with username ${fuser.username} and userid ${fuser.id}`
            );
        }
    }

    console.log("=======================");
    console.log(
        `Created ${usersCreatedCount} users, updated ${usersUpdatedCount} users, total ${
            usersCreatedCount + usersUpdatedCount
        } users`
    );
}

importUsers(process.argv[2]);
