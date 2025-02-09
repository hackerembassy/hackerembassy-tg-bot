import { User } from "@data/models";
import { UserStateChangeType } from "@data/types";

import statusRepository from "@repositories/status";

import broadcast, { BroadcastEvents } from "../common/broadcast";
import { userService } from "./user";

export class SpaceService {
    public getState() {
        return statusRepository.getSpaceLastState();
    }

    public openSpace(opener: User, options: { checkOpener: boolean } = { checkOpener: false }): void {
        const opendate = new Date();
        const state = {
            open: 1,
            date: opendate.getTime(),
            changer_id: opener.userid,
            changer: opener,
        };

        statusRepository.pushSpaceState(state);

        broadcast.emit(BroadcastEvents.SpaceOpened, state);

        if (!options.checkOpener) return;

        userService.letIn(opener, UserStateChangeType.Opened, opendate);
    }

    public closeSpace(closer: User): void {
        const state = {
            open: 0,
            date: Date.now(),
            changer_id: closer.userid,
            changer: closer,
        };

        statusRepository.pushSpaceState(state);

        broadcast.emit(BroadcastEvents.SpaceClosed, state);
    }
}

export const spaceService = new SpaceService();
