-- V19 demo fixture: settlement and payment ledger scenarios.
--
-- This file is intentionally outside db/migration. Run numbered demo-fixture
-- files in ascending order without the mysql --force option.
--
-- Ledger contract:
-- - every new Settlement starts PENDING with paid_amount = 0 and paid_at NULL;
-- - successful Payment Attempt triggers materialize Settlement payment fields;
-- - this fixture never writes Settlement.paid_amount, status, or paid_at after
--   the initial INSERT;
-- - existing fixed rows are validated, never updated or deleted;
-- - successful payments and damage settlement evidence are immutable history.

START TRANSACTION;

CREATE TEMPORARY TABLE `_fixture_40_conflict_guard` (
	`record_key` VARCHAR(140) NOT NULL,
	`must_be_zero` TINYINT NOT NULL,
	CONSTRAINT `CK_FIXTURE_PAYMENT_MATCH`
		CHECK (`must_be_zero` = 0)
);

CREATE TEMPORARY TABLE `_fixture_expected_settlement` (
	`scenario_key` VARCHAR(50) NOT NULL,
	`settlement_id` CHAR(36) NOT NULL,
	`user_id` CHAR(9) NOT NULL,
	`rental_id` CHAR(36) NOT NULL,
	`damage_inspection_id` CHAR(36) NULL,
	`reason` VARCHAR(50) NOT NULL,
	`amount` BIGINT UNSIGNED NOT NULL,
	`final_paid_amount` BIGINT UNSIGNED NOT NULL,
	`final_status` VARCHAR(30) NOT NULL,
	`created_at` DATETIME(6) NOT NULL,
	`final_paid_at` DATETIME(6) NULL,
	`final_updated_at` DATETIME(6) NOT NULL,
	PRIMARY KEY (`settlement_id`),
	UNIQUE (`rental_id`),
	UNIQUE (`damage_inspection_id`)
);

INSERT INTO `_fixture_expected_settlement` VALUES
	(
		'damage-unpaid',
		'77000000-0000-4000-8000-000000000001',
		'202600005',
		'44000000-0000-4000-8000-000000000003',
		'66000000-0000-4000-8000-000000000001',
		'DAMAGE',
		7000,
		0,
		'PENDING',
		TIMESTAMP('2026-08-03 05:00:00.000000'),
		NULL,
		TIMESTAMP('2026-08-03 05:00:00.000000')
	),
	(
		'overdue-unpaid',
		'77000000-0000-4000-8000-000000000002',
		'202600003',
		'44000000-0000-4000-8000-000000000009',
		NULL,
		'OVERDUE',
		1000,
		0,
		'PENDING',
		TIMESTAMP('2026-08-03 05:02:00.000000'),
		NULL,
		TIMESTAMP('2026-08-03 05:02:00.000000')
	),
	(
		'overdue-partially-paid',
		'77000000-0000-4000-8000-000000000003',
		'202600002',
		'44000000-0000-4000-8000-000000000007',
		NULL,
		'OVERDUE',
		2000,
		1000,
		'PENDING',
		TIMESTAMP('2026-08-03 05:00:00.000000'),
		NULL,
		TIMESTAMP('2026-08-03 05:30:00.000000')
	),
	(
		'adjustment-paid',
		'77000000-0000-4000-8000-000000000004',
		'202600001',
		'44000000-0000-4000-8000-000000000004',
		NULL,
		'ADJUSTMENT',
		4000,
		4000,
		'PAID',
		TIMESTAMP('2026-08-03 05:05:00.000000'),
		TIMESTAMP('2026-08-03 05:16:00.000000'),
		TIMESTAMP('2026-08-03 05:20:00.000000')
	);

CREATE TEMPORARY TABLE `_fixture_expected_payment` (
	`insert_order` INT NOT NULL,
	`scenario_key` VARCHAR(50) NOT NULL,
	`payment_attempt_id` CHAR(36) NOT NULL,
	`settlement_id` CHAR(36) NOT NULL,
	`creation_request_id` VARCHAR(100) NOT NULL,
	`toss_order_id` VARCHAR(100) NULL,
	`toss_payment_key` VARCHAR(200) NULL,
	`amount` BIGINT UNSIGNED NOT NULL,
	`provider` VARCHAR(50) NOT NULL,
	`toss_status` VARCHAR(50) NULL,
	`failure_code` VARCHAR(100) NULL,
	`failure_message` VARCHAR(500) NULL,
	`status` VARCHAR(30) NOT NULL,
	`requested_at` DATETIME(6) NOT NULL,
	`approved_at` DATETIME(6) NULL,
	`completed_at` DATETIME(6) NULL,
	`created_at` DATETIME(6) NOT NULL,
	`updated_at` DATETIME(6) NOT NULL,
	PRIMARY KEY (`payment_attempt_id`),
	UNIQUE (`creation_request_id`),
	UNIQUE (`toss_order_id`),
	UNIQUE (`toss_payment_key`)
);

INSERT INTO `_fixture_expected_payment` VALUES
	(
		10,
		'partial-payment-success',
		'78000000-0000-4000-8000-000000000001',
		'77000000-0000-4000-8000-000000000003',
		'fixture-payment-partial-success',
		'fixture-toss-order-partial-success',
		'fixture-toss-key-partial-success',
		1000,
		'TOSS_SANDBOX',
		'DONE',
		NULL,
		NULL,
		'SUCCEEDED',
		TIMESTAMP('2026-08-03 05:10:00.000000'),
		TIMESTAMP('2026-08-03 05:11:00.000000'),
		TIMESTAMP('2026-08-03 05:11:01.000000'),
		TIMESTAMP('2026-08-03 05:10:00.000000'),
		TIMESTAMP('2026-08-03 05:11:01.000000')
	),
	(
		20,
		'completed-payment-success',
		'78000000-0000-4000-8000-000000000002',
		'77000000-0000-4000-8000-000000000004',
		'fixture-payment-completed-success',
		'fixture-toss-order-completed-success',
		'fixture-toss-key-completed-success',
		4000,
		'TOSS_SANDBOX',
		'DONE',
		NULL,
		NULL,
		'SUCCEEDED',
		TIMESTAMP('2026-08-03 05:15:00.000000'),
		TIMESTAMP('2026-08-03 05:16:00.000000'),
		TIMESTAMP('2026-08-03 05:16:01.000000'),
		TIMESTAMP('2026-08-03 05:15:00.000000'),
		TIMESTAMP('2026-08-03 05:16:01.000000')
	),
	(
		30,
		'failed-payment',
		'78000000-0000-4000-8000-000000000003',
		'77000000-0000-4000-8000-000000000003',
		'fixture-payment-failed',
		'fixture-toss-order-failed',
		'fixture-toss-key-failed',
		1000,
		'TOSS_SANDBOX',
		'ABORTED',
		'FIXTURE_PAYMENT_DECLINED',
		'Fixture payment was rejected',
		'FAILED',
		TIMESTAMP('2026-08-03 05:20:00.000000'),
		NULL,
		TIMESTAMP('2026-08-03 05:20:30.000000'),
		TIMESTAMP('2026-08-03 05:20:00.000000'),
		TIMESTAMP('2026-08-03 05:20:30.000000')
	),
	(
		40,
		'payment-reconciliation-required',
		'78000000-0000-4000-8000-000000000004',
		'77000000-0000-4000-8000-000000000001',
		'fixture-payment-reconciliation',
		'fixture-toss-order-reconciliation',
		'fixture-toss-key-reconciliation',
		7000,
		'TOSS_SANDBOX',
		'PARTIAL_CANCELED',
		'FIXTURE_PROVIDER_STATE_MISMATCH',
		'Fixture provider state requires reconciliation',
		'RECONCILIATION_REQUIRED',
		TIMESTAMP('2026-08-03 05:25:00.000000'),
		NULL,
		TIMESTAMP('2026-08-03 05:26:00.000000'),
		TIMESTAMP('2026-08-03 05:25:00.000000'),
		TIMESTAMP('2026-08-03 05:26:00.000000')
	);

-- Stage-30 parents and the immutable damage basis must exist before any
-- Settlement is inserted.
INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('rental-prerequisite:', `expected`.`rental_id`), 1
FROM `_fixture_expected_settlement` AS `expected`
LEFT JOIN `rental` AS `actual`
	ON `actual`.`rental_id` = `expected`.`rental_id`
	AND `actual`.`user_id` = `expected`.`user_id`
WHERE `actual`.`rental_id` IS NULL;

INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'damage-basis-prerequisite', 1
WHERE NOT EXISTS (
	SELECT 1
	FROM `damage_inspection`
	WHERE `inspection_id` = '66000000-0000-4000-8000-000000000001'
		AND `rental_id` = '44000000-0000-4000-8000-000000000003'
		AND `status` = 'COMPLETED'
		AND `admin_decision` = 'DAMAGED'
		AND `reviewed_by` = '88000000-0000-4000-8000-000000000001'
		AND `reviewed_at` IS NOT NULL
		AND `settlement_eligible_guard` = 1
);

-- Existing Settlement IDs must match the final state produced by successful
-- Payment Attempt triggers, not the transient zero-credit insert state.
INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('settlement:', `expected`.`settlement_id`), 1
FROM `_fixture_expected_settlement` AS `expected`
INNER JOIN `settlement` AS `actual`
	ON `actual`.`settlement_id` = `expected`.`settlement_id`
WHERE NOT (
	`actual`.`user_id` <=> `expected`.`user_id`
	AND `actual`.`rental_id` <=> `expected`.`rental_id`
	AND `actual`.`damage_inspection_id`
		<=> `expected`.`damage_inspection_id`
	AND `actual`.`reason` <=> `expected`.`reason`
	AND `actual`.`amount` <=> `expected`.`amount`
	AND `actual`.`paid_amount` <=> `expected`.`final_paid_amount`
	AND `actual`.`status` <=> `expected`.`final_status`
	AND `actual`.`created_at` <=> `expected`.`created_at`
	AND `actual`.`paid_at` <=> `expected`.`final_paid_at`
	AND `actual`.`updated_at` <=> `expected`.`final_updated_at`
);

-- rental_id and damage_inspection_id are unique business keys. A collision
-- owned by another fixed Settlement is a hard error, never an upsert target.
INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('settlement-unique:', `actual`.`settlement_id`), 1
FROM `settlement` AS `actual`
INNER JOIN `_fixture_expected_settlement` AS `expected`
	ON `actual`.`rental_id` = `expected`.`rental_id`
	OR (
		`actual`.`damage_inspection_id` IS NOT NULL
		AND `actual`.`damage_inspection_id`
			= `expected`.`damage_inspection_id`
	)
WHERE `actual`.`settlement_id` <> `expected`.`settlement_id`;

INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('payment:', `expected`.`payment_attempt_id`), 1
FROM `_fixture_expected_payment` AS `expected`
INNER JOIN `payment_attempt` AS `actual`
	ON `actual`.`payment_attempt_id` = `expected`.`payment_attempt_id`
WHERE NOT (
	`actual`.`settlement_id` <=> `expected`.`settlement_id`
	AND `actual`.`creation_request_id` <=> `expected`.`creation_request_id`
	AND `actual`.`toss_order_id` <=> `expected`.`toss_order_id`
	AND `actual`.`toss_payment_key` <=> `expected`.`toss_payment_key`
	AND `actual`.`amount` <=> `expected`.`amount`
	AND `actual`.`provider` <=> `expected`.`provider`
	AND `actual`.`toss_status` <=> `expected`.`toss_status`
	AND `actual`.`failure_code` <=> `expected`.`failure_code`
	AND `actual`.`failure_message` <=> `expected`.`failure_message`
	AND `actual`.`status` <=> `expected`.`status`
	AND `actual`.`requested_at` <=> `expected`.`requested_at`
	AND `actual`.`approved_at` <=> `expected`.`approved_at`
	AND `actual`.`completed_at` <=> `expected`.`completed_at`
	AND `actual`.`created_at` <=> `expected`.`created_at`
	AND `actual`.`updated_at` <=> `expected`.`updated_at`
);

INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('payment-unique:', `actual`.`payment_attempt_id`), 1
FROM `payment_attempt` AS `actual`
INNER JOIN `_fixture_expected_payment` AS `expected`
	ON `actual`.`creation_request_id` = `expected`.`creation_request_id`
	OR `actual`.`toss_order_id` = `expected`.`toss_order_id`
	OR `actual`.`toss_payment_key` = `expected`.`toss_payment_key`
WHERE `actual`.`payment_attempt_id` <> `expected`.`payment_attempt_id`;

-- A pre-existing Settlement requires its complete fixed payment graph. This
-- prevents a replay from adding a missing successful ledger row to an already
-- materialized total.
INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('payment-graph:', `expected`.`payment_attempt_id`), 1
FROM `_fixture_expected_payment` AS `expected`
LEFT JOIN `settlement` AS `settlement_actual`
	ON `settlement_actual`.`settlement_id` = `expected`.`settlement_id`
LEFT JOIN `payment_attempt` AS `payment_actual`
	ON `payment_actual`.`payment_attempt_id` = `expected`.`payment_attempt_id`
WHERE (`settlement_actual`.`settlement_id` IS NULL)
	<> (`payment_actual`.`payment_attempt_id` IS NULL);

CREATE TEMPORARY TABLE `_fixture_new_settlement` (
	`settlement_id` CHAR(36) NOT NULL PRIMARY KEY
);

INSERT INTO `_fixture_new_settlement` (`settlement_id`)
SELECT `expected`.`settlement_id`
FROM `_fixture_expected_settlement` AS `expected`
LEFT JOIN `settlement` AS `actual`
	ON `actual`.`settlement_id` = `expected`.`settlement_id`
WHERE `actual`.`settlement_id` IS NULL;

-- Required initial state. No final paid total is copied from the expected
-- table; successful Payment Attempt triggers are the only credit writer.
INSERT INTO `settlement` (
	`settlement_id`, `user_id`, `rental_id`, `damage_inspection_id`,
	`reason`, `amount`, `paid_amount`, `status`,
	`created_at`, `paid_at`, `updated_at`
)
SELECT
	`expected`.`settlement_id`,
	`expected`.`user_id`,
	`expected`.`rental_id`,
	`expected`.`damage_inspection_id`,
	`expected`.`reason`,
	`expected`.`amount`,
	0,
	'PENDING',
	`expected`.`created_at`,
	NULL,
	`expected`.`created_at`
FROM `_fixture_expected_settlement` AS `expected`
INNER JOIN `_fixture_new_settlement` AS `new_row`
	ON `new_row`.`settlement_id` = `expected`.`settlement_id`;

-- SUCCEEDED rows run first and credit their Settlement through V16 triggers.
-- FAILED and RECONCILIATION_REQUIRED are terminal evidence but add no credit.
INSERT INTO `payment_attempt` (
	`payment_attempt_id`, `settlement_id`, `creation_request_id`,
	`toss_order_id`, `toss_payment_key`, `amount`, `provider`, `toss_status`,
	`failure_code`, `failure_message`, `status`, `requested_at`,
	`approved_at`, `completed_at`, `created_at`, `updated_at`
)
SELECT
	`expected`.`payment_attempt_id`,
	`expected`.`settlement_id`,
	`expected`.`creation_request_id`,
	`expected`.`toss_order_id`,
	`expected`.`toss_payment_key`,
	`expected`.`amount`,
	`expected`.`provider`,
	`expected`.`toss_status`,
	`expected`.`failure_code`,
	`expected`.`failure_message`,
	`expected`.`status`,
	`expected`.`requested_at`,
	`expected`.`approved_at`,
	`expected`.`completed_at`,
	`expected`.`created_at`,
	`expected`.`updated_at`
FROM `_fixture_expected_payment` AS `expected`
LEFT JOIN `payment_attempt` AS `actual`
	ON `actual`.`payment_attempt_id` = `expected`.`payment_attempt_id`
WHERE `actual`.`payment_attempt_id` IS NULL
ORDER BY `expected`.`insert_order`;

-- ON UPDATE timestamps are nondeterministic. Normalize only updated_at on
-- newly inserted rows; payment fields remain exactly as written by triggers.
UPDATE `settlement` AS `actual`
INNER JOIN `_fixture_expected_settlement` AS `expected`
	ON `expected`.`settlement_id` = `actual`.`settlement_id`
INNER JOIN `_fixture_new_settlement` AS `new_row`
	ON `new_row`.`settlement_id` = `actual`.`settlement_id`
SET `actual`.`updated_at` = `expected`.`final_updated_at`
WHERE `actual`.`updated_at` <> `expected`.`final_updated_at`;

-- Exact final Settlement materialization.
INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('settlement-final:', `expected`.`settlement_id`), 1
FROM `_fixture_expected_settlement` AS `expected`
INNER JOIN `settlement` AS `actual`
	ON `actual`.`settlement_id` = `expected`.`settlement_id`
WHERE NOT (
	`actual`.`user_id` <=> `expected`.`user_id`
	AND `actual`.`rental_id` <=> `expected`.`rental_id`
	AND `actual`.`damage_inspection_id`
		<=> `expected`.`damage_inspection_id`
	AND `actual`.`reason` <=> `expected`.`reason`
	AND `actual`.`amount` <=> `expected`.`amount`
	AND `actual`.`paid_amount` <=> `expected`.`final_paid_amount`
	AND `actual`.`status` <=> `expected`.`final_status`
	AND `actual`.`created_at` <=> `expected`.`created_at`
	AND `actual`.`paid_at` <=> `expected`.`final_paid_at`
	AND `actual`.`updated_at` <=> `expected`.`final_updated_at`
);

-- paid_amount is exactly the sum of immutable successful Payment Attempts.
INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('payment-total:', `settlement_actual`.`settlement_id`), 1
FROM `settlement` AS `settlement_actual`
INNER JOIN `_fixture_expected_settlement` AS `expected`
	ON `expected`.`settlement_id` = `settlement_actual`.`settlement_id`
LEFT JOIN (
	SELECT `settlement_id`, SUM(`amount`) AS `succeeded_amount`
	FROM `payment_attempt`
	WHERE `status` = 'SUCCEEDED'
	GROUP BY `settlement_id`
) AS `payment_total`
	ON `payment_total`.`settlement_id` = `settlement_actual`.`settlement_id`
WHERE `settlement_actual`.`paid_amount`
	<> COALESCE(`payment_total`.`succeeded_amount`, 0);

-- Reason/amount policy is repeated as an explicit fixture assertion.
INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('settlement-amount-policy:', `settlement_id`), 1
FROM `settlement`
WHERE `settlement_id` IN (
	SELECT `settlement_id` FROM `_fixture_expected_settlement`
)
	AND NOT (
		(`reason` IN ('DAMAGE', 'LOSS') AND `amount` = 7000)
		OR (
			`reason` = 'OVERDUE'
			AND `amount` BETWEEN 1000 AND 6000
			AND MOD(`amount`, 1000) = 0
		)
		OR (`reason` = 'ADJUSTMENT' AND `amount` BETWEEN 0 AND 7000)
	);

-- DAMAGE must remain bound directly to the same reviewed inspection Rental.
INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('damage-settlement:', `settlement_actual`.`settlement_id`), 1
FROM `settlement` AS `settlement_actual`
INNER JOIN `damage_inspection` AS `inspection`
	ON `inspection`.`inspection_id`
		= `settlement_actual`.`damage_inspection_id`
WHERE `settlement_actual`.`settlement_id`
	= '77000000-0000-4000-8000-000000000001'
	AND NOT (
		`settlement_actual`.`reason` = 'DAMAGE'
		AND `settlement_actual`.`amount` = 7000
		AND `inspection`.`rental_id` = `settlement_actual`.`rental_id`
		AND `inspection`.`status` = 'COMPLETED'
		AND `inspection`.`admin_decision` = 'DAMAGED'
		AND `inspection`.`reviewed_by` IS NOT NULL
		AND `inspection`.`reviewed_at` IS NOT NULL
	);

INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('payment-state:', `payment_attempt_id`), 1
FROM `payment_attempt`
WHERE `payment_attempt_id` IN (
	SELECT `payment_attempt_id` FROM `_fixture_expected_payment`
)
	AND (
		(
			`status` = 'SUCCEEDED'
			AND (`approved_at` IS NULL OR `completed_at` IS NULL)
		)
		OR (
			`status` IN ('FAILED', 'RECONCILIATION_REQUIRED')
			AND `completed_at` IS NULL
		)
	);

INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('request-prefix:', `creation_request_id`), 1
FROM `_fixture_expected_payment`
WHERE `creation_request_id` NOT LIKE 'fixture-%'
	OR (`toss_order_id` IS NOT NULL AND `toss_order_id` NOT LIKE 'fixture-%')
	OR (
		`toss_payment_key` IS NOT NULL
		AND `toss_payment_key` NOT LIKE 'fixture-%'
	);

-- The V16 trigger handshake must be consumed in the same statement. Fixture
-- code never inserts or deletes internal guard rows itself.
INSERT INTO `_fixture_40_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'payment-mutation-guard-leak', 1
WHERE (
	SELECT COUNT(*) FROM `settlement_payment_mutation_guard`
) <> 0;

SELECT
	`expected`.`scenario_key`,
	`actual`.`settlement_id`,
	`actual`.`reason`,
	`actual`.`amount`,
	`actual`.`paid_amount`,
	`actual`.`status`,
	`actual`.`paid_at`,
	`actual`.`damage_inspection_id`
FROM `_fixture_expected_settlement` AS `expected`
INNER JOIN `settlement` AS `actual`
	ON `actual`.`settlement_id` = `expected`.`settlement_id`
ORDER BY `actual`.`settlement_id`;

SELECT
	`expected`.`scenario_key`,
	`actual`.`payment_attempt_id`,
	`actual`.`settlement_id`,
	`actual`.`amount`,
	`actual`.`provider`,
	`actual`.`toss_status`,
	`actual`.`status`,
	`actual`.`failure_code`
FROM `_fixture_expected_payment` AS `expected`
INNER JOIN `payment_attempt` AS `actual`
	ON `actual`.`payment_attempt_id` = `expected`.`payment_attempt_id`
ORDER BY `expected`.`insert_order`;

DROP TEMPORARY TABLE `_fixture_new_settlement`;
DROP TEMPORARY TABLE `_fixture_expected_payment`;
DROP TEMPORARY TABLE `_fixture_expected_settlement`;
DROP TEMPORARY TABLE `_fixture_40_conflict_guard`;

COMMIT;
