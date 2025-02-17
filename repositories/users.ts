import { ChatId } from "node-telegram-bot-api";
import { eq, like, sql, ne } from "drizzle-orm";

import { users } from "@data/schema";

import BaseRepository from "./base";

type User = typeof users.$inferSelect;
class UserRepository extends BaseRepository {
    getUsers() {
        return this.db.select().from(users).all();
    }

    getSponsors() {
        return this.db.select().from(users).where(ne(users.sponsorship, 0)).all();
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
