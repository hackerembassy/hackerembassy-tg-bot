CREATE TABLE `topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT (null)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`topic_id` integer NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `states` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`open` integer NOT NULL,
	`date` integer NOT NULL,
	`changer_id` integer NOT NULL,
	FOREIGN KEY (`changer_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `needs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item` text NOT NULL,
	`requester_id` integer NOT NULL,
	`buyer_id` integer,
	`updated` integer,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `userstates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` integer NOT NULL,
	`date` integer NOT NULL,
	`until` integer DEFAULT (NULL),
	`type` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT (NULL),
	`user_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `donations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fund_id` integer NOT NULL,
	`value` integer NOT NULL,
	`currency` text NOT NULL,
	`user_id` integer NOT NULL,
	`accountant_id` integer NOT NULL,
	FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accountant_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `funds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`target_value` integer NOT NULL,
	`target_currency` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`userid` integer PRIMARY KEY NOT NULL,
	`username` text,
	`first_name` text,
	`roles` text DEFAULT 'default',
	`mac` text DEFAULT (NULL),
	`birthday` text DEFAULT (NULL),
	`autoinside` integer DEFAULT 0,
	`emoji` text DEFAULT (NULL),
	`language` text
);
--> statement-breakpoint
CREATE INDEX `donation_fund_idx` ON `donations` (`fund_id`);--> statement-breakpoint
CREATE INDEX `accountant_idx` ON `donations` (`accountant_id`);--> statement-breakpoint
CREATE INDEX `donation_user_idx` ON `donations` (`user_id`);--> statement-breakpoint
CREATE INDEX `fundname_idx` ON `funds` (`name`);--> statement-breakpoint
CREATE INDEX `username_idx` ON `users` (`username`);