import { EventEmitter } from "events";

export const enum BroadcastEvents {
    SpaceOpened = "space-opened",
    SpaceClosed = "space-closed",
    SpaceUnlocked = "space-unlocked",
}

const broadcast = new EventEmitter();

export default broadcast;
