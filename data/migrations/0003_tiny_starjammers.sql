CREATE TABLE `devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mac` text NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_mac_unique` ON `devices` (`mac`);--> statement-breakpoint
CREATE INDEX `mac_idx` ON `devices` (`mac`);--> statement-breakpoint
INSERT INTO `devices` (`mac`, `user_id`) SELECT `mac`, `userid` FROM `users` WHERE mac IS NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `mac`;