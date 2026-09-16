import { UserStateChangeType, UserStateType } from "@data/types";
import { TEST_USERS } from "@data/seed";

import { userService } from "@services/domain/user";

describe("UserService evictPeople", () => {
    it("evicts ghosts (secret status) along with regular people inside", () => {
        userService.letIn(TEST_USERS.accountant, UserStateChangeType.Force, new Date(), undefined, false);
        userService.letIn(TEST_USERS.guest, UserStateChangeType.Force, new Date(), undefined, true);

        expect(userService.getUserState(TEST_USERS.accountant)?.status).toBe(UserStateType.Inside);
        expect(userService.getUserState(TEST_USERS.guest)?.status).toBe(UserStateType.InsideSecret);

        userService.evictPeople();

        const accountantState = userService.getUserState(TEST_USERS.accountant);
        const guestState = userService.getUserState(TEST_USERS.guest);

        expect(accountantState?.status).toBe(UserStateType.Outside);
        expect(accountantState?.type).toBe(UserStateChangeType.Evicted);
        expect(guestState?.status).toBe(UserStateType.Outside);
        expect(guestState?.type).toBe(UserStateChangeType.Evicted);

        expect(userService.getPeopleInside(true)).toHaveLength(0);
    });
});
