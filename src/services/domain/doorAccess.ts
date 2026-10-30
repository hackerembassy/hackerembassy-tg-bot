import { DoorAccessGrant, User } from "@data/models";
import DoorAccessRepository from "@data/repositories/doorAccess";

import { DAY, isTimeOnly, parseLocalDateTime, parseLongDuration } from "@utils/date";

export interface AccessWindow {
    startsAt: Date;
    endsAt: Date;
}

export type AccessGrantError = "order" | "expired" | "toolong" | "toofar";

export type AccessGrantResult = { grant: DoorAccessGrant } | { error: AccessGrantError };

const ACCESS_WINDOW_REGEX = /^(?:from (.+?) )?(?:to (.+)|for (\S+))$/i;

class DoorAccessService {
    public readonly maxDurationDays = 3;
    public readonly maxLeadDays = 7;

    private readonly windowRules: [AccessGrantError, (window: AccessWindow, now: Date) => boolean][] = [
        ["order", ({ startsAt, endsAt }) => endsAt <= startsAt],
        ["expired", ({ endsAt }, now) => endsAt <= now],
        ["toolong", ({ startsAt, endsAt }) => endsAt.getTime() - startsAt.getTime() > this.maxDurationDays * DAY],
        ["toofar", ({ startsAt }, now) => startsAt.getTime() - now.getTime() > this.maxLeadDays * DAY],
    ];

    // "[from <when>] to <when>" or "[from <when>] for <duration>"; <when> is "DD-MM-YYYY HH:mm" or "HH:mm" (today)
    public parseWindow(text: string, now = new Date()): Optional<AccessWindow> {
        const match = ACCESS_WINDOW_REGEX.exec(text.trim());

        if (!match) return;

        const [, fromText, toText, durationText] = match;
        const startsAt = fromText ? parseLocalDateTime(fromText, now) : now;

        if (!startsAt) return;

        if (durationText) {
            const duration = parseLongDuration(durationText);

            return duration ? { startsAt, endsAt: new Date(startsAt.getTime() + duration) } : undefined;
        }

        const endsAt = parseLocalDateTime(toText, startsAt);

        if (!endsAt) return;

        // "from 22:00 to 02:00" means the night into the next day
        if (isTimeOnly(toText) && endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);

        return { startsAt, endsAt };
    }

    public grant(target: User, actor: User, window: AccessWindow, now = new Date()): AccessGrantResult {
        const error = this.windowRules.find(([, isBroken]) => isBroken(window, now))?.[0];

        if (error) return { error };

        return {
            grant: DoorAccessRepository.addGrant({
                user_id: target.userid,
                granted_by: actor.userid,
                starts_at: window.startsAt,
                ends_at: window.endsAt,
            }),
        };
    }

    public hasActiveGrant(user: User, now = new Date()): boolean {
        return DoorAccessRepository.getActiveGrant(user.userid, now) !== undefined;
    }

    public revoke(target: User, actor: User, now = new Date()): DoorAccessGrant[] {
        return DoorAccessRepository.revokeUnexpiredGrants(target.userid, actor.userid, now);
    }
}

export const doorAccessService = new DoorAccessService();
