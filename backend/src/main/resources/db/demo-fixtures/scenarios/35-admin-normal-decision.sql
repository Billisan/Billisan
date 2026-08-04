-- Opt-in scenario 35: completed NORMAL administrator decision history.
START TRANSACTION;

CREATE TEMPORARY TABLE `_scenario_35_guard` (
	`record_key` VARCHAR(140) NOT NULL, `must_be_zero` TINYINT NOT NULL,
	CHECK (`must_be_zero` = 0)
);

-- Target: 202600004 / 59b97d2b-a37d-4f75-bd33-4beb1bd3ac76.
INSERT INTO `_scenario_35_guard`
SELECT CONCAT('other-scenario:', `marker`.`request_key`), 1
FROM (
	SELECT `rental_request_id` AS `request_key` FROM `rental`
	UNION ALL SELECT `request_id` FROM `return_attempt`
	UNION ALL SELECT `request_id` FROM `damage_inspection`
	UNION ALL SELECT `creation_request_id` FROM `payment_attempt`
) AS `marker`
WHERE `marker`.`request_key` LIKE 'fixture-scenario-%'
	AND `marker`.`request_key` NOT LIKE 'fixture-scenario-35-%'
LIMIT 1;

INSERT INTO `_scenario_35_guard`
SELECT 'baseline-user', 1
WHERE NOT EXISTS (SELECT 1 FROM `rental` WHERE `rental_id` = 'b3500000-0000-4000-8000-000000000001')
	AND NOT EXISTS (
		SELECT 1 FROM `user_account`
		WHERE `user_id` = '202600004'
			AND `user_ref` = '59b97d2b-a37d-4f75-bd33-4beb1bd3ac76'
			AND `face_registered` = TRUE AND `rental_eligible` = TRUE
	);

INSERT INTO `_scenario_35_guard`
SELECT 'partial-graph', 1
WHERE ((EXISTS (SELECT 1 FROM `rental` WHERE `rental_id` = 'b3500000-0000-4000-8000-000000000001'))
	+ (EXISTS (SELECT 1 FROM `return_attempt` WHERE `return_attempt_id` = 'b3500000-0000-4000-8000-000000000002'))
	+ (EXISTS (SELECT 1 FROM `damage_inspection` WHERE `inspection_id` = 'b3500000-0000-4000-8000-000000000003'))) NOT IN (0, 3);

INSERT INTO `_scenario_35_guard`
SELECT 'rental-conflict', 1 FROM `rental`
WHERE `rental_id` = 'b3500000-0000-4000-8000-000000000001'
	AND NOT (`user_id` <=> '202600004' AND `rental_request_id` <=> 'fixture-scenario-35-normal-rental'
		AND `status` <=> 'COMPLETED' AND `ended_at` <=> TIMESTAMP('2026-08-04 14:20:00.000000'));
INSERT INTO `_scenario_35_guard`
SELECT 'return-conflict', 1 FROM `return_attempt`
WHERE `return_attempt_id` = 'b3500000-0000-4000-8000-000000000002'
	AND NOT (`rental_id` <=> 'b3500000-0000-4000-8000-000000000001'
		AND `return_slot_id` <=> '33000000-0000-4000-8000-000000000001'
		AND `request_id` <=> 'fixture-scenario-35-normal-return' AND `status` <=> 'COMPLETED');
INSERT INTO `_scenario_35_guard`
SELECT 'inspection-conflict', 1 FROM `damage_inspection`
WHERE `inspection_id` = 'b3500000-0000-4000-8000-000000000003'
	AND NOT (`return_attempt_id` <=> 'b3500000-0000-4000-8000-000000000002'
		AND `rental_id` <=> 'b3500000-0000-4000-8000-000000000001'
		AND `request_id` <=> 'fixture-scenario-35-normal-inspection'
		AND `status` <=> 'COMPLETED' AND `ai_result` <=> 'NORMAL'
		AND `admin_decision` <=> 'NORMAL'
		AND `reviewed_by` <=> '88000000-0000-4000-8000-000000000001'
		AND `reviewed_at` IS NOT NULL);

INSERT INTO `rental` (`rental_id`, `user_id`, `checkout_slot_id`, `rental_request_id`, `status`,
	`failure_code`, `failure_message`, `failed_at`, `requested_at`, `rented_at`, `due_at`, `ended_at`, `created_at`, `updated_at`)
SELECT 'b3500000-0000-4000-8000-000000000001', '202600004',
	'33000000-0000-4000-8000-000000000001', 'fixture-scenario-35-normal-rental',
	'RETURNING', NULL, NULL, NULL, TIMESTAMP('2026-08-03 14:00:00.000000'),
	TIMESTAMP('2026-08-03 14:01:00.000000'), TIMESTAMP('2026-08-04 14:01:00.000000'), NULL,
	TIMESTAMP('2026-08-03 14:00:00.000000'), TIMESTAMP('2026-08-04 14:20:00.000000')
WHERE NOT EXISTS (SELECT 1 FROM `rental` WHERE `rental_id` = 'b3500000-0000-4000-8000-000000000001');

INSERT INTO `return_attempt` (`return_attempt_id`, `rental_id`, `return_slot_id`, `request_id`, `status`,
	`physical_completed_at`, `completed_at`, `failure_reason`, `created_at`, `updated_at`)
SELECT 'b3500000-0000-4000-8000-000000000002', 'b3500000-0000-4000-8000-000000000001',
	'33000000-0000-4000-8000-000000000001', 'fixture-scenario-35-normal-return', 'COMPLETED',
	TIMESTAMP('2026-08-04 14:19:00.000000'), TIMESTAMP('2026-08-04 14:20:00.000000'), NULL,
	TIMESTAMP('2026-08-04 14:10:00.000000'), TIMESTAMP('2026-08-04 14:20:00.000000')
WHERE NOT EXISTS (SELECT 1 FROM `return_attempt` WHERE `return_attempt_id` = 'b3500000-0000-4000-8000-000000000002');

UPDATE `rental` SET `updated_at` = TIMESTAMP('2026-08-04 14:20:00.000000')
WHERE `rental_id` = 'b3500000-0000-4000-8000-000000000001';

INSERT INTO `damage_inspection` (`inspection_id`, `return_attempt_id`, `rental_id`, `request_id`,
	`requested_at`, `status`, `ai_result`, `confidence`, `model_version`, `completed_at`,
	`admin_decision`, `reviewed_by`, `reviewed_at`, `created_at`, `updated_at`)
SELECT 'b3500000-0000-4000-8000-000000000003', 'b3500000-0000-4000-8000-000000000002',
	'b3500000-0000-4000-8000-000000000001', 'fixture-scenario-35-normal-inspection',
	TIMESTAMP('2026-08-04 14:21:00.000000'), 'COMPLETED', 'NORMAL', 0.9900, 'fixture-ai-v1',
	TIMESTAMP('2026-08-04 14:22:00.000000'), 'NORMAL',
	'88000000-0000-4000-8000-000000000001', TIMESTAMP('2026-08-04 14:23:00.000000'),
	TIMESTAMP('2026-08-04 14:21:00.000000'), TIMESTAMP('2026-08-04 14:23:00.000000')
WHERE NOT EXISTS (SELECT 1 FROM `damage_inspection` WHERE `inspection_id` = 'b3500000-0000-4000-8000-000000000003');

UPDATE `slot` SET `service_status` = 'AVAILABLE', `occupancy_status` = 'OCCUPIED',
	`lock_status` = 'LOCKED', `item_condition` = 'NORMAL',
	`updated_at` = TIMESTAMP('2026-08-04 14:23:00.000000')
WHERE `slot_id` = '33000000-0000-4000-8000-000000000001';

UPDATE `user_account` AS `user`
SET `user`.`rental_eligible` = (`user`.`face_registered`
	AND NOT EXISTS (SELECT 1 FROM `rental` WHERE `rental`.`user_id` = `user`.`user_id` AND `rental`.`status` IN ('REQUESTED', 'ACTIVE', 'RETURNING'))
	AND NOT EXISTS (SELECT 1 FROM `return_attempt` AS `attempt` INNER JOIN `rental` ON `rental`.`rental_id` = `attempt`.`rental_id` WHERE `rental`.`user_id` = `user`.`user_id` AND `attempt`.`status` = 'RECOVERY_REQUIRED')
	AND NOT EXISTS (SELECT 1 FROM `settlement` WHERE `settlement`.`user_id` = `user`.`user_id` AND `settlement`.`paid_amount` < `settlement`.`amount`)),
	`user`.`rental_eligibility_evaluated_at` = TIMESTAMP('2026-08-04 14:24:00.000000'),
	`user`.`updated_at` = TIMESTAMP('2026-08-04 14:24:00.000000')
WHERE `user`.`user_id` = '202600004' AND `user`.`user_ref` = '59b97d2b-a37d-4f75-bd33-4beb1bd3ac76';

INSERT INTO `_scenario_35_guard`
SELECT 'postcondition', 1
WHERE NOT EXISTS (
	SELECT 1 FROM `damage_inspection` AS `inspection`
	INNER JOIN `return_attempt` AS `attempt` ON `attempt`.`return_attempt_id` = `inspection`.`return_attempt_id`
	INNER JOIN `slot` ON `slot`.`slot_id` = `attempt`.`return_slot_id`
	WHERE `inspection`.`inspection_id` = 'b3500000-0000-4000-8000-000000000003'
		AND `inspection`.`rental_id` = `attempt`.`rental_id`
		AND `inspection`.`admin_decision` = 'NORMAL'
		AND `slot`.`service_status` = 'AVAILABLE' AND `slot`.`item_condition` = 'NORMAL'
)
	OR NOT EXISTS (SELECT 1 FROM `user_account` WHERE `user_id` = '202600004' AND `rental_eligible` = TRUE);

DROP TEMPORARY TABLE `_scenario_35_guard`;
COMMIT;
