export const enum UserStateChangeType {
    Manual = 0,
    Auto = 1,
    Force = 2,
    Opened = 3,
    Evicted = 4,
    TimedOut = 5,
}

export const enum UserStateType {
    Outside = 0,
    Inside = 1,
    Going = 2,
    InsideSecret = 3,
}

export type UserRole = "admin" | "member" | "accountant" | "trusted" | "default" | "restricted";

export const enum AutoInsideMode {
    Disabled = 0,
    Enabled = 1,
    Ghost = 2,
}
