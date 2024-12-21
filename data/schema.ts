import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const states = sqliteTable("states", {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    open: integer("open").notNull(),
    date: integer("date").notNull(),
    changer_id: integer("changer_id")
        .notNull()
        .references(() => users.userid),
});

export const funds = sqliteTable(
    "funds",
    {
        id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
        name: text("name").notNull().unique(),
        target_value: integer("target_value").notNull(),
        target_currency: text("target_currency").notNull(),
        status: text("status").default("open").notNull(),
    },
    table => {
        return {
            fundname_idx: index("fundname_idx").on(table.name),
        };
    }
);

export const topics = sqliteTable("topics", {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    name: text("name").notNull(),
    description: text("description").default(sql`(NULL)`),
});

export const users = sqliteTable(
    "users",
    {
        userid: integer("userid").primaryKey().notNull(),
        username: text("username"),
        first_name: text("first_name"),
        roles: text("roles").default("default"),
        mac: text("mac").default(sql`(NULL)`),
        birthday: text("birthday").default(sql`(NULL)`),
        autoinside: integer("autoinside").default(0),
        emoji: text("emoji").default(sql`(NULL)`),
        language: text("language"),
        sponsorship: text("sponsorship").default(sql`(NULL)`),
    },
    table => {
        return {
            username_idx: index("username_idx").on(table.username),
        };
    }
);

export const subscriptions = sqliteTable("subscriptions", {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    user_id: integer("user_id")
        .notNull()
        .references(() => users.userid, { onDelete: "cascade" }),
    topic_id: integer("topic_id")
        .notNull()
        .references(() => topics.id, { onDelete: "cascade" }),
});

export const donations = sqliteTable(
    "donations",
    {
        id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
        fund_id: integer("fund_id")
            .notNull()
            .references(() => funds.id),
        value: integer("value").notNull(),
        currency: text("currency").notNull(),
        date: integer("date", { mode: "timestamp" }).default(sql`0`),
        user_id: integer("user_id")
            .notNull()
            .references(() => users.userid),
        accountant_id: integer("accountant_id")
            .notNull()
            .references(() => users.userid),
    },
    table => {
        return {
            donation_fund_idx: index("donation_fund_idx").on(table.fund_id),
            accountant_idx: index("accountant_idx").on(table.accountant_id),
            donation_user_idx: index("donation_user_idx").on(table.user_id),
        };
    }
);

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
    type: integer("type").default(0).notNull(),
    note: text("note").default(sql`(NULL)`),
    user_id: integer("user_id")
        .notNull()
        .references(() => users.userid),
});
