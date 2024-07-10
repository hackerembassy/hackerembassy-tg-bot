import { users, donations, funds, needs, subscriptions, topics, userstates, states } from "data/schema";

export type User = typeof users.$inferSelect;
export type Donation = typeof donations.$inferSelect;
export type Fund = typeof funds.$inferSelect;
export type Need = typeof needs.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type UserState = typeof userstates.$inferSelect;
export type State = typeof states.$inferSelect;

export type UserStateEx = UserState & { user: User };
export type StateEx = State & { changer: User };
export type DonationEx = Donation & { fund: Fund; user: User; accountant: User };
