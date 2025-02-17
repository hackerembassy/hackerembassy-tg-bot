import { eq } from "drizzle-orm";

import { devices } from "@data/schema";

import BaseRepository from "./base";

class DevicesRepository extends BaseRepository {
    getDevices(joinUsers = false) {
        return this.db.query.devices
            .findMany({
                with: {
                    user: joinUsers ? true : undefined,
                },
            })
            .sync();
    }

    getDeviceById(id: number) {
        return this.db.select().from(devices).where(eq(devices.id, id)).get();
    }

    getDevicesByUserId(userId: number) {
        return this.db.select().from(devices).where(eq(devices.user_id, userId)).all();
    }

    getDeviceByMac(mac: string) {
        return this.db.select().from(devices).where(eq(devices.mac, mac)).get();
    }

    addDevice(userId: number, mac: string) {
        return this.db.insert(devices).values({ user_id: userId, mac }).run();
    }

    removeDeviceById(id: number) {
        return this.db.delete(devices).where(eq(devices.id, id)).run();
    }

    removeDeviceByMac(mac: string) {
        return this.db.delete(devices).where(eq(devices.mac, mac)).run();
    }

    removeUserDevices(userId: number) {
        return this.db.delete(devices).where(eq(devices.user_id, userId)).run();
    }

    updateDevice(userId: number, mac: string) {
        return this.db.update(devices).set({ user_id: userId, mac }).where(eq(devices.mac, mac)).run();
    }
}

export default new DevicesRepository();
