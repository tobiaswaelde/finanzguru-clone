CREATE INDEX `position_lot_account` ON `position_lot` (`account_id`);--> statement-breakpoint
CREATE INDEX `position_lot_instrument` ON `position_lot` (`instrument_id`);--> statement-breakpoint
CREATE INDEX `transaction_category_booking` ON `transaction` (`category_id`,`booking_date`);