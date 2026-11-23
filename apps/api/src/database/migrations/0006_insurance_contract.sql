CREATE TABLE `insurance_contract` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`contract_number` text,
	`premium_cents` integer NOT NULL,
	`interval` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`notes` text,
	`linked_category_id` text,
	FOREIGN KEY (`linked_category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "insurance_premium_positive" CHECK("insurance_contract"."premium_cents" BETWEEN 1 AND 750599937895082),
	CONSTRAINT "insurance_date_order" CHECK("insurance_contract"."end_date" IS NULL OR "insurance_contract"."end_date" >= "insurance_contract"."start_date"),
	CONSTRAINT "insurance_notes_length" CHECK(length("insurance_contract"."notes") <= 2000)
);
