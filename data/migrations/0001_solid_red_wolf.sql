PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`userid` integer PRIMARY KEY NOT NULL,
	`username` text,
	`first_name` text,
	`roles` text DEFAULT 'default',
	`mac` text DEFAULT (NULL),
	`birthday` text DEFAULT (NULL),
	`autoinside` integer DEFAULT 0,
	`emoji` text DEFAULT (NULL),
	`language` text,
	`sponsorship` integer DEFAULT 0
);
--> statement-breakpoint
INSERT INTO `__new_users`("userid", "username", "first_name", "roles", "mac", "birthday", "autoinside", "emoji", "language", "sponsorship") SELECT "userid", "username", "first_name", "roles", "mac", "birthday", "autoinside", "emoji", "language", "sponsorship" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `username_idx` ON `users` (`username`);