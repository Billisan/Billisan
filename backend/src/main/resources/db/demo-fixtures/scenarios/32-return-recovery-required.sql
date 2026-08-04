-- Opt-in scenario 32: RECOVERY_REQUIRED Return blocks an otherwise eligible user.
START TRANSACTION;

CREATE TEMPORARY TABLE `_scenario_32_guard` (
	`record_key` VARCHAR(140) NOT NULL,
	`must_be_zero` TINYINT NOT NULL,
	CHECK (`must_be_zero` = 0)
);

-- Target: 202600002 / f86a8791-c02b-4e50-b761-d9dd009909a9.
INSERT INTO `_scenario_32_guard`
SELECT CONCAT('other-scenario:', `marker`.`request_key`), 1
FROM (
	SELECT `rental_request_id` AS `request_key` FROM `rental`
	UNION ALL SELECT `request_id` FROM `return_attempt`
	UNION ALL SELECT `request_id` FROM `damage_inspection`
	UNION ALL SELECT `creation_request_id` FROM `payment_attempt`
) AS `marker`
WHERE `marker`.`request_key` LIKE 'fixture-scenario-%'
	AND `marker`.`request_key` NOT LIKE 'fixture-scenario-32-%'
LIMIT 1;

INSERT INTO `_scenario_32_guard`
SELECT 'baseline-user', 1
WHERE NOT EXISTS (
	SELECT 1 FROM `rental` WHERE `rental_id` = 'b3200000-0000-4000-8000-000000000001'
)
	AND NOT EXISTS (
		SELECT 1 FROM `user_account`
		WHERE `user_id` = '202600002'
			AND `user_ref` = 'f86a8791-c02b-4e50-b761-d9dd009909a9'
			AND `face_registered` = TRUE AND `rental_eligible` = TRUE
			AND `rental_eligibility_evaluated_at` IS NOT NULL
	);

INSERT INTO `_scenario_32_guard`
SELECT 'partial-graph', 1
WHERE (
	EXISTS (SELECT 1 FROM `rental` WHERE `rental_id` = 'b3200000-0000-4000-8000-000000000001')
) <> (
	EXISTS (SELECT 1 FROM `return_attempt` WHERE `return_attempt_id` = 'b3200000-0000-4000-8000-000000000002')
);

INSERT INTO `_scenario_32_guard`
SELECT 'rental-conflict', 1 FROM `rental`
WHERE `rental_id` = 'b3200000-0000-4000-8000-000000000001'
	AND NOT (
		`user_id` <=> '202600002'
		AND `checkout_slot_id` <=> '33000000-0000-4000-8000-000000000001'
		AND `rental_request_id` <=> 'fixture-scenario-32-return-recovery-rental'
		AND `status` <=> 'RETURNING'
		AND `failure_code` IS NULL AND `failure_message` IS NULL AND `failed_at` IS NULL
		AND `ended_at` IS NULL
	);

INSERT INTO `_scenario_32_guard`
SELECT 'return-conflict', 1 FROM `return_attempt`
WHERE `return_attempt_id` = 'b3200000-0000-4000-8000-000000000002'
	AND NOT (
		`rental_id` <=> 'b3200000-0000-4000-8000-000000000001'
		AND `return_slot_id` <=> '33000000-0000-4000-8000-000000000001'
		AND `request_id` <=> 'fixture-scenario-32-return-recovery-required'
		AND `status` <=> 'RECOVERY_REQUIRED'
		AND `physical_completed_at` <=> TIMESTAMP('2026-08-04 11:20:00.000000')
		AND `completed_at` IS NULL
		AND `failure_reason` <=> 'LOCK_CONFIRMATION_TIMEOUT'
	);

INSERT INTO `_scenario_32_guard`
SELECT 'request-conflict', 1 FROM `rental`
WHERE `rental_request_id` = 'fixture-scenario-32-return-recovery-rental'
	AND `rental_id` <> 'b3200000-0000-4000-8000-000000000001';
INSERT INTO `_scenario_32_guard`
SELECT 'request-conflict', 1 FROM `return_attempt`
WHERE `request_id` = 'fixture-scenario-32-return-recovery-required'
	AND `return_attempt_id` <> 'b3200000-0000-4000-8000-000000000002';

INSERT INTO `rental` (
	`rental_id`, `user_id`, `checkout_slot_id`, `rental_request_id`, `status`,
	`failure_code`, `failure_message`, `failed_at`, `requested_at`, `rented_at`,
	`due_at`, `ended_at`, `created_at`, `updated_at`
)
SELECT 'b3200000-0000-4000-8000-000000000001', '202600002',
	'33000000-0000-4000-8000-000000000001',
	'fixture-scenario-32-return-recovery-rental', 'RETURNING', NULL, NULL, NULL,
	TIMESTAMP('2026-08-04 11:00:00.000000'), TIMESTAMP('2026-08-04 11:01:00.000000'),
	TIMESTAMP('2026-08-05 11:01:00.000000'), NULL,
	TIMESTAMP('2026-08-04 11:00:00.000000'), TIMESTAMP('2026-08-04 11:21:00.000000')
WHERE NOT EXISTS (
	SELECT 1 FROM `rental` WHERE `rental_id` = 'b3200000-0000-4000-8000-000000000001'
);

INSERT INTO `return_attempt` (
	`return_attempt_id`, `rental_id`, `return_slot_id`, `request_id`, `status`,
	`physical_completed_at`, `completed_at`, `failure_reason`, `created_at`, `updated_at`
)
SELECT 'b3200000-0000-4000-8000-000000000002',
	'b3200000-0000-4000-8000-000000000001',
	'33000000-0000-4000-8000-000000000001',
	'fixture-scenario-32-return-recovery-required', 'RECOVERY_REQUIRED',
	TIMESTAMP('2026-08-04 11:20:00.000000'), NULL, 'LOCK_CONFIRMATION_TIMEOUT',
	TIMESTAMP('2026-08-04 11:10:00.000000'), TIMESTAMP('2026-08-04 11:21:00.000000')
WHERE NOT EXISTS (
	SELECT 1 FROM `return_attempt`
	WHERE `return_attempt_id` = 'b3200000-0000-4000-8000-000000000002'
);

UPDATE `slot`
SET `service_status` = 'ADMIN_REVIEW', `occupancy_status` = 'OCCUPIED',
	`lock_status` = 'ERROR', `item_condition` = 'UNKNOWN',
	`updated_at` = TIMESTAMP('2026-08-04 11:21:00.000000')
WHERE `slot_id` = '33000000-0000-4000-8000-000000000001'
	AND (
		(`service_status` = 'AVAILABLE' AND `occupancy_status` = 'OCCUPIED'
			AND `lock_status` = 'LOCKED' AND `item_condition` = 'NORMAL')
		OR (`service_status` = 'ADMIN_REVIEW' AND `occupancy_status` = 'OCCUPIED'
			AND `lock_status` = 'ERROR' AND `item_condition` = 'UNKNOWN')
	);

UPDATE `user_account` AS `user`
SET `user`.`rental_eligible` = (
	`user`.`face_registered`
	AND NOT EXISTS (SELECT 1 FROM `rental` WHERE `rental`.`user_id` = `user`.`user_id` AND `rental`.`status` IN ('REQUESTED', 'ACTIVE', 'RETURNING'))
	AND NOT EXISTS (SELECT 1 FROM `return_attempt` AS `attempt` INNER JOIN `rental` ON `rental`.`rental_id` = `attempt`.`rental_id` WHERE `rental`.`user_id` = `user`.`user_id` AND `attempt`.`status` = 'RECOVERY_REQUIRED')
	AND NOT EXISTS (SELECT 1 FROM `settlement` WHERE `settlement`.`user_id` = `user`.`user_id` AND `settlement`.`paid_amount` < `settlement`.`amount`)
), `user`.`rental_eligibility_evaluated_at` = TIMESTAMP('2026-08-04 11:22:00.000000'),
	`user`.`updated_at` = TIMESTAMP('2026-08-04 11:22:00.000000')
WHERE `user`.`user_id` = '202600002'
	AND `user`.`user_ref` = 'f86a8791-c02b-4e50-b761-d9dd009909a9';

INSERT INTO `_scenario_32_guard`
SELECT 'postcondition', 1
WHERE NOT EXISTS (
	SELECT 1 FROM `rental` AS `rental`
	INNER JOIN `return_attempt` AS `attempt` ON `attempt`.`rental_id` = `rental`.`rental_id`
	WHERE `rental`.`rental_id` = 'b3200000-0000-4000-8000-000000000001'
		AND `rental`.`status` = 'RETURNING'
		AND `attempt`.`status` = 'RECOVERY_REQUIRED'
)
	OR NOT EXISTS (
		SELECT 1 FROM `user_account`
		WHERE `user_id` = '202600002' AND `rental_eligible` = FALSE
			AND `rental_eligibility_evaluated_at` IS NOT NULL
	);

DROP TEMPORARY TABLE `_scenario_32_guard`;
COMMIT;
