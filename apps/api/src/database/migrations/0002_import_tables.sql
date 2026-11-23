CREATE TABLE `categorization_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`priority` integer NOT NULL,
	`match_field` text NOT NULL,
	`operator` text NOT NULL,
	`pattern` text NOT NULL,
	`amount_sign` text,
	`category_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rule_priority_nonnegative" CHECK("categorization_rule"."priority" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categorization_rule_priority_unique` ON `categorization_rule` (`priority`);--> statement-breakpoint
CREATE TABLE `csv_mapping` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`header_signature` text NOT NULL,
	`delimiter` text NOT NULL,
	`encoding` text NOT NULL,
	`date_format` text NOT NULL,
	`decimal_separator` text NOT NULL,
	`columns` text NOT NULL,
	`default_account_id` text,
	FOREIGN KEY (`default_account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `csv_mapping_header_signature_unique` ON `csv_mapping` (`header_signature`);--> statement-breakpoint
CREATE TABLE `import_job` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`kind` text NOT NULL,
	`file_name` text,
	`file_sha256` text,
	`format` text,
	`status` text NOT NULL,
	`imported` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`errors` text DEFAULT '[]' NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`source_id`) REFERENCES `data_source`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "import_job_counts_nonnegative" CHECK("import_job"."imported" >= 0 AND "import_job"."skipped" >= 0 AND "import_job"."failed" >= 0),
	CONSTRAINT "import_job_errors_bounded" CHECK(json_valid("import_job"."errors") AND json_type("import_job"."errors") = 'array' AND json_array_length("import_job"."errors") <= 500)
);
--> statement-breakpoint
ALTER TABLE `transaction` ADD `import_job_id` text REFERENCES import_job(id) ON DELETE SET NULL;
