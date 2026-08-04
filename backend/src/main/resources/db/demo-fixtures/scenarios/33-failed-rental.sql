-- Opt-in scenario 33: failed checkout history for the face-unregistered user.
START TRANSACTION;

CREATE TEMPORARY TABLE `_scenario_33_guard` (
	`record_key` VARCHAR(140) NOT NULL,
	`must_be_zero` TINYINT NOT NULL,
	CHECK (`must_be_zero` = 0)
);

-- Target: 202600007 / bb14cac2-74d1-4b7f-a69f-aa88fcf8f55e.
INSERT INTO `_scenario_33_guard`
SELECT CONCAT('other-scenario:', `marker`.`request_key`), 1
FROM (
	SELECT `rental_request_id` AS `request_key` FROM `rental`
	UNION ALL SELECT `request_id` FROM `return_attempt`
	UNION ALL SELECT `request_id` FROM `damage_inspection`
	UNION ALL SELECT `creation_request_id` FROM `payment_attempt`
) AS `marker`
WHERE `marker`.`request_key` LIKE 'fixture-scenario-%'
	AND `marker`.`request_key` NOT LIKE 'fixture-scenario-33-%'
LIMIT 1;

INSERT INTO `_scenario_33_guard`
SELECT 'baseline-user', 1
WHERE NOT EXISTS (
	SELECT 1 FROM `rental` WHERE `rental_id` = 'b3300000-0000-4000-8000-000000000001'
)
	AND NOT EXISTS (
		SELECT 1 FROM `user_account`
		WHERE `user_id` = '202600007'
			AND `user_ref` = 'bb14cac2-74d1-4b7f-a69f-aa88fcf8f55e'
			AND `face_registered` = FALSE AND `rental_eligible` = FALSE
			AND `rental_eligibility_evaluated_at` IS NOT NULL
	);

INSERT INTO `_scenario_33_guard`
SELECT 'rental-conflict', 1 FROM `rental`
WHERE `rental_id` = 'b3300000-0000-4000-8000-000000000001'
	AND NOT (
		`user_id` <=> '202600007'
		AND `checkout_slot_id` <=> '33000000-0000-4000-8000-000000000001'
		AND `rental_request_id` <=> 'fixture-scenario-33-failed-rental'
		AND `status` <=> 'FAILED'
		AND `failure_code` <=> 'USER_NOT_ELIGIBLE'
		AND `failure_message` <=> 'Face profile is not registered'
		AND `failed_at` <=> TIMESTAMP('2026-08-04 12:00:05.000000')
		AND `rented_at` IS NULL AND `due_at` IS NULL AND `ended_at` IS NULL
	);

INSERT INTO `_scenario_33_guard`
SELECT 'request-conflict', 1 FROM `rental`
WHERE `rental_request_id` = 'fixture-scenario-33-failed-rental'
	AND `rental_id` <> 'b3300000-0000-4000-8000-000000000001';

INSERT INTO `rental` (
	`rental_id`, `user_id`, `checkout_slot_id`, `rental_request_id`, `status`,
	`failure_code`, `failure_message`, `failed_at`, `requested_at`, `rented_at`,
	`due_at`, `ended_at`, `created_at`, `updated_at`
)
SELECT 'b3300000-0000-4000-8000-000000000001', '202600007',
	'33000000-0000-4000-8000-000000000001', 'fixture-scenario-33-failed-rental',
	'FAILED', 'USER_NOT_ELIGIBLE', 'Face profile is not registered',
	TIMESTAMP('2026-08-04 12:00:05.000000'), TIMESTAMP('2026-08-04 12:00:00.000000'),
	NULL, NULL, NULL, TIMESTAMP('2026-08-04 12:00:00.000000'),
	TIMESTAMP('2026-08-04 12:00:05.000000')
WHERE NOT EXISTS (
	SELECT 1 FROM `rental` WHERE `rental_id` = 'b3300000-0000-4000-8000-000000000001'
);

UPDATE `user_account` AS `user`
SET `user`.`rental_eligible` = (
	`user`.`face_registered`
	AND NOT EXISTS (SELECT 1 FROM `rental` WHERE `rental`.`user_id` = `user`.`user_id` AND `rental`.`status` IN ('REQUESTED', 'ACTIVE', 'RETURNING'))
	AND NOT EXISTS (SELECT 1 FROM `return_attempt` AS `attempt` INNER JOIN `rental` ON `rental`.`rental_id` = `attempt`.`rental_id` WHERE `rental`.`user_id` = `user`.`user_id` AND `attempt`.`status` = 'RECOVERY_REQUIRED')
	AND NOT EXISTS (SELECT 1 FROM `settlement` WHERE `settlement`.`user_id` = `user`.`user_id` AND `settlement`.`paid_amount` < `settlement`.`amount`)
), `user`.`rental_eligibility_evaluated_at` = TIMESTAMP('2026-08-04 12:01:00.000000'),
	`user`.`updated_at` = TIMESTAMP('2026-08-04 12:01:00.000000')
WHERE `user`.`user_id` = '202600007'
	AND `user`.`user_ref` = 'bb14cac2-74d1-4b7f-a69f-aa88fcf8f55e';

INSERT INTO `_scenario_33_guard`
SELECT 'postcondition', 1
WHERE NOT EXISTS (
	SELECT 1 FROM `rental`
	WHERE `rental_id` = 'b3300000-0000-4000-8000-000000000001'
		AND `status` = 'FAILED' AND `failure_code` IS NOT NULL AND `failed_at` IS NOT NULL
)
	OR NOT EXISTS (
		SELECT 1 FROM `user_account`
		WHERE `user_id` = '202600007' AND `rental_eligible` = FALSE
			AND `rental_eligibility_evaluated_at` IS NOT NULL
	);

DROP TEMPORARY TABLE `_scenario_33_guard`;
COMMIT;
