CREATE TABLE `budget` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`monthly_limit_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "budget_limit_positive" CHECK("budget"."monthly_limit_cents" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_category_id_unique` ON `budget` (`category_id`);