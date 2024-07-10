-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `states` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`open` integer,
	`changedby` text,
	`date` integer
);
--> statement-breakpoint
CREATE TABLE `funds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`target_value` integer,
	`target_currency` text,
	`status` text DEFAULT 'open'
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT (null)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text,
	`roles` text DEFAULT 'default',
	`mac` text DEFAULT (NULL),
	`birthday` text DEFAULT (NULL),
	`autoinside` integer DEFAULT 0,
	`emoji` text DEFAULT (NULL),
	`userid` integer NOT NULL,
	`language` text
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
CREATE TABLE `donations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fund_id` integer,
	`value` integer,
	`currency` text,
	`user_id` integer NOT NULL,
	`accountant_id` integer NOT NULL,
	FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accountant_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `needs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text,
	`requester_id` integer NOT NULL,
	`buyer_id` integer NOT NULL,
	`updated` integer,
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `userstates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` integer,
	`date` integer,
	`until` integer DEFAULT (NULL),
	`type` integer DEFAULT 0,
	`note` text DEFAULT (NULL),
	`user_id` integer NOT NULL
);

*/