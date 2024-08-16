import { StateEx, User } from "./models";
import { AutoInsideMode } from "./types";

export const DefaultUser: User = {
    userid: 0,
    username: null,
    first_name: null,
    roles: "default",
    mac: null,
    birthday: null,
    autoinside: AutoInsideMode.Disabled,
    emoji: null,
    language: null,
};

export const SERVICE_USERS = {
    anon: {
        ...DefaultUser,
        userid: 1,
        username: "anon",
        roles: "service",
    },
    paid: {
        ...DefaultUser,
        userid: 2,
        username: "paid",
        roles: "service",
    },
    safe: {
        ...DefaultUser,
        userid: 3,
        username: "safe",
        roles: "service",
    },
    hass: {
        ...DefaultUser,
        userid: 4,
        username: "hass",
        roles: "service",
    },
};

export const TEST_USERS = {
    admin: {
        ...DefaultUser,
        userid: 10,
        username: "admin",
        roles: "admin|member|accountant",
    },
    accountant: {
        ...DefaultUser,
        userid: 11,
        username: "accountant",
        roles: "member|accountant",
    },
    guest: {
        ...DefaultUser,
        userid: 12,
        username: "guest",
    },
};

export const DefaultState: StateEx = {
    id: 0,
    open: 0,
    date: 0,
    changer_id: 0,
    changer: SERVICE_USERS.anon,
};

export const SEED_SERVICE_USERS: User[] = [SERVICE_USERS.anon, SERVICE_USERS.paid, SERVICE_USERS.safe, SERVICE_USERS.hass];

export const SEED_TEST_USERS: User[] = [TEST_USERS.admin, TEST_USERS.accountant, TEST_USERS.guest];
