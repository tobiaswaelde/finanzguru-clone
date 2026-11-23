CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`iban` text,
	`parent_account_id` text,
	`source_id` text,
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`last_synced_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institution`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_id`) REFERENCES `data_source`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "account_name_length" CHECK(length("account"."name") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_iban_unique` ON `account` (`iban`);--> statement-breakpoint
CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`color` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_sibling_name` ON `category` (`parent_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `category_root_name` ON `category` (`name`) WHERE "category"."parent_id" IS NULL;--> statement-breakpoint
CREATE TABLE `data_source` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`display_name` text NOT NULL,
	`encrypted_credentials` blob,
	`tool_manifest` text,
	`last_sync_at` text,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `institution` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bic` text,
	`logo_key` text,
	CONSTRAINT "institution_bic_length" CHECK(length("institution"."bic") IN (8, 11))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `institution_name_unique` ON `institution` (`name`);--> statement-breakpoint
CREATE TABLE `instrument` (
	`id` text PRIMARY KEY NOT NULL,
	`isin` text NOT NULL,
	`wkn` text,
	`name` text NOT NULL,
	`asset_class` text NOT NULL,
	`currency` text NOT NULL,
	CONSTRAINT "instrument_isin_length" CHECK(length("instrument"."isin") = 12),
	CONSTRAINT "instrument_wkn_length" CHECK(length("instrument"."wkn") = 6),
	CONSTRAINT "instrument_currency_shape" CHECK("instrument"."currency" GLOB '[A-Z][A-Z][A-Z]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instrument_isin_unique` ON `instrument` (`isin`);--> statement-breakpoint
CREATE TABLE `net_worth_snapshot` (
	`account_id` text NOT NULL,
	`date` text NOT NULL,
	`value_cents` integer NOT NULL,
	`invested_cents` integer NOT NULL,
	`external_flow_cents` integer NOT NULL,
	PRIMARY KEY(`account_id`, `date`),
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `owner` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`inflation_rate` text DEFAULT '0.0253' NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "owner_name_length" CHECK(length("owner"."display_name") BETWEEN 1 AND 60),
	CONSTRAINT "owner_inflation_range" CHECK(CAST("owner"."inflation_rate" AS REAL) BETWEEN 0 AND 0.5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `owner_singleton` ON `owner` ((1));--> statement-breakpoint
CREATE TABLE `position_lot` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	`open_date` text NOT NULL,
	`quantity_open` text NOT NULL,
	`cost_per_unit` text NOT NULL,
	`closed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "position_lot_quantity_nonnegative" CHECK(CAST("position_lot"."quantity_open" AS REAL) >= 0)
);
--> statement-breakpoint
CREATE TABLE `price` (
	`instrument_id` text NOT NULL,
	`date` text NOT NULL,
	`close` text NOT NULL,
	`source` text NOT NULL,
	PRIMARY KEY(`instrument_id`, `date`),
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "price_positive" CHECK(CAST("price"."close" AS REAL) > 0)
);
--> statement-breakpoint
CREATE TABLE `transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`booking_date` text NOT NULL,
	`value_date` text,
	`amount_cents` integer NOT NULL,
	`type` text NOT NULL,
	`counterparty` text,
	`counterparty_iban` text,
	`purpose` text,
	`instrument_id` text,
	`quantity` text,
	`unit_price` text,
	`fee_cents` integer DEFAULT 0 NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`category_id` text,
	`category_source` text,
	`review_status` text DEFAULT 'unreviewed' NOT NULL,
	`source` text NOT NULL,
	`source_ref` text,
	`fingerprint` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transaction_instrument_required" CHECK("transaction"."type" NOT IN ('buy', 'sell', 'dividend', 'split') OR "transaction"."instrument_id" IS NOT NULL),
	CONSTRAINT "transaction_trade_values_required" CHECK("transaction"."type" NOT IN ('buy', 'sell') OR (COALESCE(CAST("transaction"."quantity" AS REAL), 0) > 0 AND COALESCE(CAST("transaction"."unit_price" AS REAL), 0) > 0)),
	CONSTRAINT "transaction_split_ratio_required" CHECK("transaction"."type" <> 'split' OR COALESCE(CAST("transaction"."quantity" AS REAL), 0) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_fingerprint_unique` ON `transaction` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `transaction_account_booking` ON `transaction` (`account_id`,`booking_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_source_ref` ON `transaction` (`source`,`source_ref`);