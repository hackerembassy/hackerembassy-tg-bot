CREATE TABLE `door_access_grants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`granted_by` integer NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`revoked_by` integer DEFAULT (NULL),
	`revoked_at` integer DEFAULT (NULL),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revoked_by`) REFERENCES `users`(`userid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `door_access_user_idx` ON `door_access_grants` (`user_id`);