-- Opt-in scenario 31: ACTIVE Rental blocks an otherwise eligible user.
START TRANSACTION;

CREATE TEMPORARY TABLE `_scenario_31_guard` (
	`record_key` VARCHAR(140) NOT NULL,
	`must_be_zero` TINYINT NOT NULL,
	CHECK (`must_be_zero` = 0)
);

-- Target: 202600001 / f6f509d4-c001-446c-b6b7-537d65a093c3.
INSERT INTO `_scenario_31_guard`
SELECT CONCAT('other-scenario:', `marker`.`request_key`), 1
FROM (
	SELECT `rental_request_id` AS `request_key` FROM `rental`
	UNION ALL SELECT `request_id` FROM `return_attempt`
	UNION ALL SELECT `request_id` FROM `damage_inspection`
	UNION ALL SELECT `creation_request_id` FROM `payment_attempt`
) AS `marker`
WHERE `marker`.`request_key` LIKE 'fixture-scenario-%'
	AND `marker`.`request_key` NOT LIKE 'fixture-scenario-31-%'
LIMIT 1;

INSERT INTO `_scenario_31_guard`
SELECT 'baseline-user', 1
WHERE NOT EXISTS (
	SELECT 1 FROM `rental`
	WHERE `rental_id` = 'b3100000-0000-4000-8000-000000000001'
)
	AND NOT EXISTS (
		SELECT 1 FROM `user_account`
		WHERE `user_id` = '202600001'
			AND `user_ref` = 'f6f509d4-c001-446c-b6b7-537d65a093c3'
			AND `face_registered` = TRUE
			AND `rental_eligible` = TRUE
			AND `rental_eligibility_evaluated_at` IS NOT NULL
	);

INSERT INTO `_scenario_31_guard`
SELECT 'baseline-authority', 1
WHERE NOT EXISTS (
	SELECT 1 FROM `rental`
	WHERE `rental_id` = 'b3100000-0000-4000-8000-000000000001'
)
	AND (
		EXISTS (
			SELECT 1 FROM `rental`
			WHERE `user_id` = '202600001'
				AND `status` IN ('REQUESTED', 'ACTIVE', 'RETURNING')
		)
		OR EXISTS (
			SELECT 1 FROM `return_attempt` AS `attempt`
			INNER JOIN `rental` ON `rental`.`rental_id` = `attempt`.`rental_id`
			WHERE `rental`.`user_id` = '202600001'
				AND `attempt`.`status` = 'RECOVERY_REQUIRED'
		)
		OR EXISTS (
			SELECT 1 FROM `settlement`
			WHERE `user_id` = '202600001' AND `paid_amount` < `amount`
		)
	);

INSERT INTO `_scenario_31_guard`
SELECT 'rental-conflict', 1
FROM `rental`
WHERE `rental_id` = 'b3100000-0000-4000-8000-000000000001'
	AND NOT (
		`user_id` <=> '202600001'
		AND `checkout_slot_id` <=> '33000000-0000-4000-8000-000000000001'
		AND `rental_request_id` <=> 'fixture-scenario-31-active-rental'
		AND `status` <=> 'ACTIVE'
		AND `failure_code` IS NULL AND `failure_message` IS NULL AND `failed_at` IS NULL
		AND `requested_at` <=> TIMESTAMP('2026-08-04 10:00:00.000000')
		AND `rented_at` <=> TIMESTAMP('2026-08-04 10:01:00.000000')
		AND `due_at` <=> TIMESTAMP('2026-08-05 10:01:00.000000')
		AND `ended_at` IS NULL
	);

INSERT INTO `_scenario_31_guard`
SELECT 'rental-request-conflict', 1
FROM `rental`
WHERE `rental_request_id` = 'fixture-scenario-31-active-rental'
	AND `rental_id` <> 'b3100000-0000-4000-8000-000000000001';

INSERT INTO `rental` (
	`rental_id`, `user_id`, `checkout_slot_id`, `rental_request_id`, `status`,
	`failure_code`, `failure_message`, `failed_at`, `requested_at`, `rented_at`,
	`due_at`, `ended_at`, `created_at`, `updated_at`
)
SELECT
	'b3100000-0000-4000-8000-000000000001', '202600001',
	'33000000-0000-4000-8000-000000000001',
	'fixture-scenario-31-active-rental', 'ACTIVE', NULL, NULL, NULL,
	TIMESTAMP('2026-08-04 10:00:00.000000'), TIMESTAMP('2026-08-04 10:01:00.000000'),
	TIMESTAMP('2026-08-05 10:01:00.000000'), NULL,
	TIMESTAMP('2026-08-04 10:00:00.000000'), TIMESTAMP('2026-08-04 10:01:00.000000')
WHERE NOT EXISTS (
	SELECT 1 FROM `rental`
	WHERE `rental_id` = 'b3100000-0000-4000-8000-000000000001'
);

UPDATE `user_account` AS `user`
SET
	`user`.`rental_eligible` = (
		`user`.`face_registered`
		AND NOT EXISTS (
			SELECT 1 FROM `rental`
			WHERE `rental`.`user_id` = `user`.`user_id`
				AND `rental`.`status` IN ('REQUESTED', 'ACTIVE', 'RETURNING')
		)
		AND NOT EXISTS (
			SELECT 1 FROM `return_attempt` AS `attempt`
			INNER JOIN `rental` ON `rental`.`rental_id` = `attempt`.`rental_id`
			WHERE `rental`.`user_id` = `user`.`user_id`
				AND `attempt`.`status` = 'RECOVERY_REQUIRED'
		)
		AND NOT EXISTS (
			SELECT 1 FROM `settlement`
			WHERE `settlement`.`user_id` = `user`.`user_id`
				AND `settlement`.`paid_amount` < `settlement`.`amount`
		)
	),
	`user`.`rental_eligibility_evaluated_at` = TIMESTAMP('2026-08-04 10:02:00.000000'),
	`user`.`updated_at` = TIMESTAMP('2026-08-04 10:02:00.000000')
WHERE `user`.`user_id` = '202600001'
	AND `user`.`user_ref` = 'f6f509d4-c001-446c-b6b7-537d65a093c3';

INSERT INTO `_scenario_31_guard`
SELECT 'postcondition', 1
WHERE NOT EXISTS (
	SELECT 1 FROM `rental`
	WHERE `rental_id` = 'b3100000-0000-4000-8000-000000000001'
		AND `status` = 'ACTIVE'
)
	OR NOT EXISTS (
		SELECT 1 FROM `user_account`
		WHERE `user_id` = '202600001'
			AND `user_ref` = 'f6f509d4-c001-446c-b6b7-537d65a093c3'
			AND `rental_eligible` = FALSE
			AND `rental_eligibility_evaluated_at` IS NOT NULL
	);

DROP TEMPORARY TABLE `_scenario_31_guard`;
COMMIT;
