CREATE TABLE `source_account` (
	`source_id` text NOT NULL,
	`external_ref` text NOT NULL,
	`account_id` text NOT NULL,
	PRIMARY KEY(`source_id`, `external_ref`),
	FOREIGN KEY (`source_id`) REFERENCES `data_source`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
