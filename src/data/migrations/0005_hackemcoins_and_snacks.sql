CREATE TABLE `hackemcoin_balances` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `hackemcoin_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`reason` text DEFAULT (NULL),
	`actor_id` integer NOT NULL,
	`donation_id` integer DEFAULT (NULL),
	`snack_id` integer DEFAULT (NULL),
	`ref_id` integer DEFAULT (NULL),
	`date` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`snack_id`) REFERENCES `snacks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `hackemcoin_user_idx` ON `hackemcoin_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `hackemcoin_donation_idx` ON `hackemcoin_transactions` (`donation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `hackemcoin_donation_reward_idx` ON `hackemcoin_transactions` (`donation_id`) WHERE "hackemcoin_transactions"."type" = 'donation';--> statement-breakpoint
CREATE INDEX `hackemcoin_ref_idx` ON `hackemcoin_transactions` (`ref_id`);--> statement-breakpoint
CREATE TABLE `snacks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`removed` integer DEFAULT false NOT NULL,
	`created_by` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `snacks_name_unique` ON `snacks` (`name`);