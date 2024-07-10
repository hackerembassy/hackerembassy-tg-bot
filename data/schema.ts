import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const states = sqliteTable("states", {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    open: integer("open").notNull(),
    changer_id: integer("changer_id")
        .notNull()
        .references(() => users.userid),
    date: integer("date").notNull(),
});

export const funds = sqliteTable("funds", {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    name: text("name").notNull().unique(),
    target_value: integer("target_value").notNull(),
    target_currency: text("target_currency").notNull(),
    status: text("status").default("open").notNull(),
});

export const topics = sqliteTable("topics", {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    name: text("name").notNull(),
    description: text("description").default(sql`(NULL)`),
});

export const users = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    username: text("username"),
    roles: text("roles").default("default"),
    mac: text("mac").default(sql`(NULL)`),
    birthday: text("birthday").default(sql`(NULL)`),
    autoinside: integer("autoinside").default(0),
    emoji: text("emoji").default(sql`(NULL)`),
    userid: integer("userid").notNull(),
    language: text("language"),
});

export const subscriptions = sqliteTable("subscriptions", {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    user_id: integer("user_id")
        .notNull()
        .references(() => users.userid, { onDelete: "cascade" }),
    topic_id: integer("topic_id")
        .notNull()
        .references(() => topics.id, { onDelete: "cascade" }),
});

export const donations = sqliteTable("donations", {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    fund_id: integer("fund_id")
        .notNull()
        .references(() => funds.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
    currency: text("currency").notNull(),
    user_id: integer("user_id")
        .notNull()
        .references(() => users.userid),
    accountant_id: integer("accountant_id")
        .notNull()
        .references(() => users.userid),
});

export const needs = sqliteTable("needs", {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    item: text("item").notNull(),
    requester_id: integer("requester_id")
        .notNull()
        .references(() => users.userid),
    buyer_id: integer("buyer_id")
        .default(sql`(NULL)`)
        .references(() => users.userid),
    updated: integer("updated"),
});

export const userstates = sqliteTable("userstates", {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    status: integer("status").notNull(),
    date: integer("date").notNull(),
    until: integer("until").default(sql`(NULL)`),
    type: integer("type").notNull().default(0),
    note: text("note").default(sql`(NULL)`),
    user_id: integer("user_id")
        .notNull()
        .references(() => users.userid),
});
