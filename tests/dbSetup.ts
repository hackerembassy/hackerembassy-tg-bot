export const ADMIN_USER = {
    username: "adminusername",
    roles: ["admin", "member", "accountant"],
    userid: 1,
};
export const ACCOUNTANT_USER = {
    username: "accountantusername",
    roles: ["member", "accountant"],
    userid: 2,
};
export const GUEST_USER = {
    username: "guestusername",
    userid: 3,
};

const DB_USERS = [ADMIN_USER, ACCOUNTANT_USER];

export async function prepareDb() {
    const usersRepository = (await import("../repositories/usersRepository")).default;

    DB_USERS.forEach(user => usersRepository.addUser(user.username, user.roles, user.userid));
}
