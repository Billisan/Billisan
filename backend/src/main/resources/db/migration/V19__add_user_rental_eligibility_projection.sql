-- User rental-eligibility projection:
-- - RENTAL, RETURN_ATTEMPT, SETTLEMENT, and USER_ACCOUNT.face_registered
--   remain the authoritative business facts.
-- - USER_ACCOUNT.rental_eligible is a fail-closed read projection for fast
--   availability checks and must be revalidated from the authoritative facts
--   before a rental is created.
-- - Time-driven overdue settlement maintenance is implemented separately by
--   the Spring scheduler; this migration only establishes and safely backfills
--   the projection columns.

ALTER TABLE `user_account`
	ADD COLUMN `rental_eligible` BOOLEAN NULL
		COMMENT 'Fail-closed rental eligibility projection; not a business SSOT'
		AFTER `face_registered`,
	ADD COLUMN `rental_eligibility_updated_at` DATETIME(6) NULL
		COMMENT 'Last time the rental eligibility projection was calculated'
		AFTER `rental_eligible`;

-- Existing rows are derived from the current authoritative records rather
-- than being marked eligible unconditionally. An indeterminate or blocked
-- state is always backfilled as false.
UPDATE `user_account` AS `u`
SET
	`rental_eligible` = (
		`u`.`face_registered` = TRUE
		AND NOT EXISTS (
			SELECT 1
			FROM `rental` AS `r`
			WHERE `r`.`user_id` = `u`.`user_id`
				AND `r`.`status` IN ('REQUESTED', 'ACTIVE', 'RETURNING')
		)
		AND NOT EXISTS (
			SELECT 1
			FROM `return_attempt` AS `ra`
			INNER JOIN `rental` AS `r`
				ON `r`.`rental_id` = `ra`.`rental_id`
			WHERE `r`.`user_id` = `u`.`user_id`
				AND `ra`.`status` = 'RECOVERY_REQUIRED'
		)
		AND NOT EXISTS (
			SELECT 1
			FROM `settlement` AS `s`
			WHERE `s`.`user_id` = `u`.`user_id`
				AND `s`.`status` = 'PENDING'
				AND `s`.`amount` > `s`.`paid_amount`
		)
	),
	`rental_eligibility_updated_at` = CURRENT_TIMESTAMP(6);

ALTER TABLE `user_account`
	MODIFY COLUMN `rental_eligible` BOOLEAN NOT NULL DEFAULT FALSE
		COMMENT 'Fail-closed rental eligibility projection; not a business SSOT',
	MODIFY COLUMN `rental_eligibility_updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6)
		COMMENT 'Last time the rental eligibility projection was calculated',
	ADD CONSTRAINT `CK_USER_ACCOUNT_RENTAL_ELIGIBLE`
		CHECK (`rental_eligible` IN (0, 1));
