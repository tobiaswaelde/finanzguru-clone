CREATE TABLE `dashboard_layout` (
	`widget_key` text PRIMARY KEY NOT NULL,
	`position` integer NOT NULL,
	`visible` integer NOT NULL,
	CONSTRAINT "dashboard_position_range" CHECK("dashboard_layout"."position" BETWEEN 0 AND 7),
	CONSTRAINT "dashboard_visible_boolean" CHECK("dashboard_layout"."visible" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dashboard_layout_position_unique` ON `dashboard_layout` (`position`);