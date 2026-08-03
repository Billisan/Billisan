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

-- Fail the migration before tightening the columns if any row is NULL or if
-- the persisted projection differs from the same authoritative calculation.
-- The temporary table disappears with the session even when the guard fails.
CREATE TEMPORARY TABLE `_v19_rental_eligibility_backfill_guard` (
	`must_be_zero` BIGINT NOT NULL,
	CONSTRAINT `CK_V19_RENTAL_ELIGIBILITY_BACKFILL_GUARD`
		CHECK (`must_be_zero` = 0)
);

INSERT INTO `_v19_rental_eligibility_backfill_guard` (`must_be_zero`)
SELECT COUNT(*)
FROM `user_account` AS `u`
WHERE `u`.`rental_eligible` IS NULL
	OR `u`.`rental_eligibility_updated_at` IS NULL
	OR `u`.`rental_eligible` <> (
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
	);

DROP TEMPORARY TABLE `_v19_rental_eligibility_backfill_guard`;

ALTER TABLE `user_account`
	MODIFY COLUMN `rental_eligible` BOOLEAN NOT NULL DEFAULT FALSE
		COMMENT 'Fail-closed rental eligibility projection; not a business SSOT',
	MODIFY COLUMN `rental_eligibility_updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6)
		COMMENT 'Last time the rental eligibility projection was calculated',
	ADD CONSTRAINT `CK_USER_ACCOUNT_RENTAL_ELIGIBLE`
		CHECK (`rental_eligible` IN (0, 1));
