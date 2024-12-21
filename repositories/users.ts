import { ChatId } from "node-telegram-bot-api";
import { eq, like, gt, isNotNull, and, sql } from "drizzle-orm";

import { anyItemIsInList } from "@utils/filters";

import { users } from "@data/schema";

import BaseRepository from "./base";

type User = typeof users.$inferSelect;
class UserRepository extends BaseRepository {
    getUsers() {
        return this.db.select().from(users).all();
    }

    getSponsors() {
        return this.db.select().from(users).where(isNotNull(users.sponsorship)).all();
    }

    getUserByName(username: string) {
        return this.db
            .select()
            .from(users)
            .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
            .get();
    }

    getUserByUserId(userid: number | ChatId | undefined) {
        if (!userid) return undefined;

        return this.db
            .select()
            .from(users)
            .where(eq(users.userid, userid as number))
            .get();
    }

    getUsersByRole(role: string) {
        return this.db
            .select()
            .from(users)
            .where(like(users.roles, `%${role}%`))
            .all();
    }

    getAutoinsideUsers() {
        return this.db
            .select()
            .from(users)
            .where(and(gt(users.autoinside, 0), isNotNull(users.username), isNotNull(users.mac)))
            .all();
    }

    addUser(userid: number, username: Optional<string>, roles: string[] = ["default"]) {
        try {
            return this.db
                .insert(users)
                .values({
                    username,
                    roles: roles.join("|"),
                    userid: userid,
                })
                .returning()
                .get();
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    updateRoles(userid: ChatId, roles: string[] = ["default"]) {
        return (
            this.db
                .update(users)
                .set({ roles: roles.join("|") })
                .where(eq(users.userid, userid as number))
                .run().changes > 0
        );
    }

    testMACs(cmd: string): boolean {
        const macRegex = /^([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})$/;
        return cmd.split(",").every(mac => macRegex.test(mac.trim()));
    }

    getAllRegisteredMACs(): string[] {
        const registeredMacEntries = this.db
            .select({
                mac: users.mac,
            })
            .from(users)
            .where(isNotNull(users.mac))
            .all();

        return registeredMacEntries.flatMap(macEntry => macEntry.mac!.split("|"));
    }

    setMACs(userid: number | ChatId, macs: Nullable<string> = null) {
        try {
            const currentUser = this.getUserByUserId(userid);
            if (!currentUser) return false;

            const newMacs = macs ? macs.split(",").map(mac => mac.toLowerCase().replaceAll("-", ":").trim()) : [];
            const existingRegisteredMacs = this.getAllRegisteredMACs();
            const existingOtherUsersMacs = existingRegisteredMacs.filter(mac => !currentUser.mac?.split(",").includes(mac));

            const newMacsString = newMacs.join(",");

            if (anyItemIsInList(newMacs, existingOtherUsersMacs))
                throw Error(`Mac's [${newMacsString}] already exist in database`);

            return (
                this.db
                    .update(users)
                    .set({ mac: newMacsString })
                    .where(eq(users.userid, userid as number))
                    .run().changes > 0
            );
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    updateUser(userid: ChatId, user: Partial<User>) {
        return (
            this.db
                .update(users)
                .set(user)
                .where(eq(users.userid, userid as number))
                .run().changes > 0
        );
    }

    removeUserByUsername(username: string) {
        return this.db.delete(users).where(eq(users.username, username)).run().changes > 0;
    }

    removeUserById(userid: ChatId) {
        return (
            this.db
                .delete(users)
                .where(eq(users.userid, userid as number))
                .run().changes > 0
        );
    }
}

export default new UserRepository();
