import { relations } from "drizzle-orm/relations";

import { topics, subscriptions, users, funds, donations, needs, states, userstates } from "./schema";

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
    topic: one(topics, {
        fields: [subscriptions.topic_id],
        references: [topics.id],
    }),
    user: one(users, {
        fields: [subscriptions.user_id],
        references: [users.userid],
    }),
}));

export const topicsRelations = relations(topics, ({ many }) => ({
    subscriptions: many(subscriptions),
}));

export const usersRelations = relations(users, ({ many }) => ({
    subscriptions: many(subscriptions),
    donations_accountant_id: many(donations, {
        relationName: "donations_accountant_id_users_userid",
    }),
    donations_user_id: many(donations, {
        relationName: "donations_user_id_users_userid",
    }),
    needs_requester_id: many(needs, {
        relationName: "needs_requester_id_users_userid",
    }),
    needs_buyer_id: many(needs, {
        relationName: "needs_buyer_id_users_userid",
    }),
    states_changer_id: many(needs, {
        relationName: "states_changer_id_users_userid",
    }),
}));

export const donationsRelations = relations(donations, ({ one }) => ({
    fund: one(funds, {
        fields: [donations.fund_id],
        references: [funds.id],
    }),
    user_accountant_id: one(users, {
        fields: [donations.accountant_id],
        references: [users.userid],
        relationName: "donations_accountant_id_users_userid",
    }),
    user_user_id: one(users, {
        fields: [donations.user_id],
        references: [users.userid],
        relationName: "donations_user_id_users_userid",
    }),
}));

export const fundsRelations = relations(funds, ({ many }) => ({
    donations: many(donations),
}));

export const needsRelations = relations(needs, ({ one }) => ({
    requester: one(users, {
        fields: [needs.requester_id],
        references: [users.userid],
        relationName: "needs_requester_id_users_userid",
    }),
    buyer: one(users, {
        fields: [needs.buyer_id],
        references: [users.userid],
        relationName: "needs_buyer_id_users_userid",
    }),
}));

export const statesRelations = relations(states, ({ one }) => ({
    changer: one(users, {
        fields: [states.changer_id],
        references: [users.userid],
    }),
}));

export const usesrstatesRelations = relations(userstates, ({ one }) => ({
    user: one(users, {
        fields: [userstates.user_id],
        references: [users.userid],
    }),
}));
