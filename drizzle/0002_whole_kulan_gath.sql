CREATE TABLE `credit_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`order_id` text,
	`entry_type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`balance_starter_after_cents` integer,
	`balance_paid_after_cents` integer,
	`idempotency_key` text,
	`metadata` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_ledger_entries_idempotency_key_unique` ON `credit_ledger_entries` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `user_credits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`starter_credits_cents` integer DEFAULT 0 NOT NULL,
	`paid_credits_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
