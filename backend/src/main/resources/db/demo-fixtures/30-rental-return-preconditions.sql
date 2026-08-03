-- V19 demo fixture: rental, return, inspection, and device preconditions.
--
-- This file is intentionally outside db/migration. Run numbered demo-fixture
-- files in ascending order without the mysql --force option.
--
-- Reapplication contract:
-- - insert a missing fixed ID only;
-- - validate every existing fixed row before DML;
-- - never use INSERT IGNORE or an upsert;
-- - let TRG_RETURN_ATTEMPT_BEFORE_INSERT complete RETURNING rentals;
-- - keep DEVICE_OPERATION independent from Rental and Return Attempt IDs.

START TRANSACTION;

CREATE TEMPORARY TABLE `_fixture_30_conflict_guard` (
	`record_key` VARCHAR(120) NOT NULL,
	`must_be_zero` TINYINT NOT NULL,
	CONSTRAINT `CK_FIXTURE_RENTAL_RETURN_MATCH`
		CHECK (`must_be_zero` = 0)
);

CREATE TEMPORARY TABLE `_fixture_expected_rental` (
	`scenario_key` VARCHAR(50) NOT NULL,
	`rental_id` CHAR(36) NOT NULL,
	`user_id` CHAR(9) NOT NULL,
	`checkout_slot_id` CHAR(36) NOT NULL,
	`rental_request_id` VARCHAR(100) NOT NULL,
	`insert_status` VARCHAR(30) NOT NULL,
	`final_status` VARCHAR(30) NOT NULL,
	`failure_code` VARCHAR(100) NULL,
	`failure_message` VARCHAR(500) NULL,
	`failed_at` DATETIME(6) NULL,
	`requested_at` DATETIME(6) NOT NULL,
	`rented_at` DATETIME(6) NULL,
	`due_at` DATETIME(6) NULL,
	`ended_at` DATETIME(6) NULL,
	`created_at` DATETIME(6) NOT NULL,
	`updated_at` DATETIME(6) NOT NULL,
	PRIMARY KEY (`rental_id`),
	UNIQUE (`rental_request_id`)
);

INSERT INTO `_fixture_expected_rental` VALUES
	(
		'completed-normal',
		'44000000-0000-4000-8000-000000000004',
		'202600001',
		'33000000-0000-4000-8000-000000000001',
		'fixture-rental-normal-completed',
		'RETURNING',
		'COMPLETED',
		NULL,
		NULL,
		NULL,
		TIMESTAMP('2026-08-03 00:10:00.000000'),
		TIMESTAMP('2026-08-03 00:11:00.000000'),
		TIMESTAMP('2026-08-04 00:11:00.000000'),
		TIMESTAMP('2026-08-03 00:30:00.000000'),
		TIMESTAMP('2026-08-03 00:10:00.000000'),
		TIMESTAMP('2026-08-03 00:35:00.000000')
	),
	(
		'completed-ai-failed',
		'44000000-0000-4000-8000-000000000006',
		'202600006',
		'33000000-0000-4000-8000-000000000002',
		'fixture-rental-ai-failed',
		'RETURNING',
		'COMPLETED',
		NULL,
		NULL,
		NULL,
		TIMESTAMP('2026-08-03 01:35:00.000000'),
		TIMESTAMP('2026-08-03 01:36:00.000000'),
		TIMESTAMP('2026-08-04 01:36:00.000000'),
		TIMESTAMP('2026-08-03 01:50:00.000000'),
		TIMESTAMP('2026-08-03 01:35:00.000000'),
		TIMESTAMP('2026-08-03 01:52:00.000000')
	),
	(
		'active-rental',
		'44000000-0000-4000-8000-000000000001',
		'202600003',
		'33000000-0000-4000-8000-000000000001',
		'fixture-rental-active',
		'ACTIVE',
		'ACTIVE',
		NULL,
		NULL,
		NULL,
		TIMESTAMP('2026-08-03 01:00:00.000000'),
		TIMESTAMP('2026-08-03 01:01:00.000000'),
		TIMESTAMP('2026-08-04 01:01:00.000000'),
		NULL,
		TIMESTAMP('2026-08-03 01:00:00.000000'),
		TIMESTAMP('2026-08-03 01:01:00.000000')
	),
	(
		'failed-rental',
		'44000000-0000-4000-8000-000000000005',
		'202600002',
		'33000000-0000-4000-8000-000000000002',
		'fixture-rental-face-ineligible',
		'FAILED',
		'FAILED',
		'USER_NOT_ELIGIBLE',
		'Fixture user is not eligible for rental',
		TIMESTAMP('2026-08-03 01:30:05.000000'),
		TIMESTAMP('2026-08-03 01:30:00.000000'),
		NULL,
		NULL,
		NULL,
		TIMESTAMP('2026-08-03 01:30:00.000000'),
		TIMESTAMP('2026-08-03 01:30:05.000000')
	),
	(
		'return-recovery',
		'44000000-0000-4000-8000-000000000002',
		'202600004',
		'33000000-0000-4000-8000-000000000002',
		'fixture-rental-return-recovery',
		'RETURNING',
		'RETURNING',
		NULL,
		NULL,
		NULL,
		TIMESTAMP('2026-08-03 02:00:00.000000'),
		TIMESTAMP('2026-08-03 02:01:00.000000'),
		TIMESTAMP('2026-08-04 02:01:00.000000'),
		NULL,
		TIMESTAMP('2026-08-03 02:00:00.000000'),
		TIMESTAMP('2026-08-03 02:21:00.000000')
	),
	(
		'unpaid-settlement-basis',
		'44000000-0000-4000-8000-000000000003',
		'202600005',
		'33000000-0000-4000-8000-000000000004',
		'fixture-rental-unpaid-settlement',
		'RETURNING',
		'COMPLETED',
		NULL,
		NULL,
		NULL,
		TIMESTAMP('2026-08-03 03:00:00.000000'),
		TIMESTAMP('2026-08-03 03:01:00.000000'),
		TIMESTAMP('2026-08-04 03:01:00.000000'),
		TIMESTAMP('2026-08-03 03:30:00.000000'),
		TIMESTAMP('2026-08-03 03:00:00.000000'),
		TIMESTAMP('2026-08-03 03:40:00.000000')
	);

CREATE TEMPORARY TABLE `_fixture_expected_return` (
	`insert_order` INT NOT NULL,
	`scenario_key` VARCHAR(50) NOT NULL,
	`return_attempt_id` CHAR(36) NOT NULL,
	`rental_id` CHAR(36) NOT NULL,
	`return_slot_id` CHAR(36) NULL,
	`request_id` VARCHAR(100) NOT NULL,
	`status` VARCHAR(30) NOT NULL,
	`physical_completed_at` DATETIME(6) NULL,
	`completed_at` DATETIME(6) NULL,
	`failure_reason` VARCHAR(255) NULL,
	`created_at` DATETIME(6) NOT NULL,
	`updated_at` DATETIME(6) NOT NULL,
	PRIMARY KEY (`return_attempt_id`),
	UNIQUE (`request_id`)
);

INSERT INTO `_fixture_expected_return` VALUES
	(
		10,
		'recovery-failed-attempt',
		'55000000-0000-4000-8000-000000000005',
		'44000000-0000-4000-8000-000000000002',
		NULL,
		'fixture-return-recovery-failed',
		'FAILED',
		NULL,
		NULL,
		'LOCK_COMMAND_TIMEOUT',
		TIMESTAMP('2026-08-03 02:05:00.000000'),
		TIMESTAMP('2026-08-03 02:06:00.000000')
	),
	(
		20,
		'completed-normal',
		'55000000-0000-4000-8000-000000000003',
		'44000000-0000-4000-8000-000000000004',
		'33000000-0000-4000-8000-000000000001',
		'fixture-return-normal-completed',
		'COMPLETED',
		TIMESTAMP('2026-08-03 00:29:00.000000'),
		TIMESTAMP('2026-08-03 00:30:00.000000'),
		NULL,
		TIMESTAMP('2026-08-03 00:25:00.000000'),
		TIMESTAMP('2026-08-03 00:30:00.000000')
	),
	(
		30,
		'completed-ai-failed',
		'55000000-0000-4000-8000-000000000004',
		'44000000-0000-4000-8000-000000000006',
		'33000000-0000-4000-8000-000000000002',
		'fixture-return-ai-failed-completed',
		'COMPLETED',
		TIMESTAMP('2026-08-03 01:49:00.000000'),
		TIMESTAMP('2026-08-03 01:50:00.000000'),
		NULL,
		TIMESTAMP('2026-08-03 01:45:00.000000'),
		TIMESTAMP('2026-08-03 01:50:00.000000')
	),
	(
		40,
		'return-recovery',
		'55000000-0000-4000-8000-000000000001',
		'44000000-0000-4000-8000-000000000002',
		'33000000-0000-4000-8000-000000000003',
		'fixture-return-recovery-required',
		'RECOVERY_REQUIRED',
		TIMESTAMP('2026-08-03 02:20:00.000000'),
		NULL,
		'LOCK_CONFIRMATION_TIMEOUT',
		TIMESTAMP('2026-08-03 02:10:00.000000'),
		TIMESTAMP('2026-08-03 02:21:00.000000')
	),
	(
		50,
		'unpaid-settlement-basis',
		'55000000-0000-4000-8000-000000000002',
		'44000000-0000-4000-8000-000000000003',
		'33000000-0000-4000-8000-000000000005',
		'fixture-return-unpaid-completed',
		'COMPLETED',
		TIMESTAMP('2026-08-03 03:29:00.000000'),
		TIMESTAMP('2026-08-03 03:30:00.000000'),
		NULL,
		TIMESTAMP('2026-08-03 03:25:00.000000'),
		TIMESTAMP('2026-08-03 03:30:00.000000')
	);

CREATE TEMPORARY TABLE `_fixture_expected_inspection` (
	`scenario_key` VARCHAR(50) NOT NULL,
	`inspection_id` CHAR(36) NOT NULL,
	`return_attempt_id` CHAR(36) NOT NULL,
	`rental_id` CHAR(36) NOT NULL,
	`request_id` VARCHAR(100) NOT NULL,
	`requested_at` DATETIME(6) NOT NULL,
	`status` VARCHAR(30) NOT NULL,
	`ai_result` VARCHAR(50) NULL,
	`confidence` DECIMAL(5,4) NULL,
	`model_version` VARCHAR(100) NULL,
	`completed_at` DATETIME(6) NULL,
	`admin_decision` VARCHAR(50) NULL,
	`reviewed_by` CHAR(36) NULL,
	`reviewed_at` DATETIME(6) NULL,
	`created_at` DATETIME(6) NOT NULL,
	`updated_at` DATETIME(6) NOT NULL,
	PRIMARY KEY (`inspection_id`),
	UNIQUE (`return_attempt_id`),
	UNIQUE (`request_id`)
);

INSERT INTO `_fixture_expected_inspection` VALUES
	(
		'admin-normal-decided',
		'66000000-0000-4000-8000-000000000002',
		'55000000-0000-4000-8000-000000000003',
		'44000000-0000-4000-8000-000000000004',
		'fixture-inspection-normal-decided',
		TIMESTAMP('2026-08-03 00:31:00.000000'),
		'COMPLETED',
		'NORMAL',
		0.9900,
		'fixture-ai-v1',
		TIMESTAMP('2026-08-03 00:32:00.000000'),
		'NORMAL',
		'88000000-0000-4000-8000-000000000001',
		TIMESTAMP('2026-08-03 00:35:00.000000'),
		TIMESTAMP('2026-08-03 00:31:00.000000'),
		TIMESTAMP('2026-08-03 00:35:00.000000')
	),
	(
		'ai-failed',
		'66000000-0000-4000-8000-000000000004',
		'55000000-0000-4000-8000-000000000004',
		'44000000-0000-4000-8000-000000000006',
		'fixture-inspection-ai-failed',
		TIMESTAMP('2026-08-03 01:51:00.000000'),
		'FAILED',
		NULL,
		NULL,
		NULL,
		TIMESTAMP('2026-08-03 01:52:00.000000'),
		NULL,
		NULL,
		NULL,
		TIMESTAMP('2026-08-03 01:51:00.000000'),
		TIMESTAMP('2026-08-03 01:52:00.000000')
	),
	(
		'admin-review-pending',
		'66000000-0000-4000-8000-000000000003',
		'55000000-0000-4000-8000-000000000001',
		'44000000-0000-4000-8000-000000000002',
		'fixture-inspection-review-pending',
		TIMESTAMP('2026-08-03 02:22:00.000000'),
		'COMPLETED',
		'UNCERTAIN',
		0.5200,
		'fixture-ai-v1',
		TIMESTAMP('2026-08-03 02:23:00.000000'),
		NULL,
		NULL,
		NULL,
		TIMESTAMP('2026-08-03 02:22:00.000000'),
		TIMESTAMP('2026-08-03 02:23:00.000000')
	),
	(
		'admin-damaged-decided',
		'66000000-0000-4000-8000-000000000001',
		'55000000-0000-4000-8000-000000000002',
		'44000000-0000-4000-8000-000000000003',
		'fixture-inspection-unpaid-damage',
		TIMESTAMP('2026-08-03 03:31:00.000000'),
		'COMPLETED',
		'DAMAGED',
		0.9700,
		'fixture-ai-v1',
		TIMESTAMP('2026-08-03 03:32:00.000000'),
		'DAMAGED',
		'88000000-0000-4000-8000-000000000001',
		TIMESTAMP('2026-08-03 03:40:00.000000'),
		TIMESTAMP('2026-08-03 03:31:00.000000'),
		TIMESTAMP('2026-08-03 03:40:00.000000')
	);

CREATE TEMPORARY TABLE `_fixture_expected_device_operation` (
	`scenario_key` VARCHAR(50) NOT NULL,
	`operation_id` CHAR(36) NOT NULL,
	`station_id` CHAR(36) NOT NULL,
	`slot_id` CHAR(36) NULL,
	`command_id` VARCHAR(100) NOT NULL,
	`event_id` VARCHAR(100) NULL,
	`issued_boot_id` VARCHAR(100) NULL,
	`operation_type` VARCHAR(50) NOT NULL,
	`status` VARCHAR(30) NOT NULL,
	`terminal_event_type` VARCHAR(50) NULL,
	`result_code` VARCHAR(100) NULL,
	`observed_occupancy_status` VARCHAR(30) NULL,
	`observed_lock_status` VARCHAR(30) NULL,
	`evidence_schema_version` SMALLINT NULL,
	`evidence_observed_at` DATETIME(6) NULL,
	`evidence_payload` JSON NULL,
	`requested_at` DATETIME(6) NOT NULL,
	`acked_at` DATETIME(6) NULL,
	`completed_at` DATETIME(6) NULL,
	`created_at` DATETIME(6) NOT NULL,
	`updated_at` DATETIME(6) NOT NULL,
	PRIMARY KEY (`operation_id`),
	UNIQUE (`command_id`),
	UNIQUE (`event_id`)
);

INSERT INTO `_fixture_expected_device_operation` VALUES
	(
		'device-command',
		'99000000-0000-4000-8000-000000000001',
		'22000000-0000-4000-8000-000000000001',
		'33000000-0000-4000-8000-000000000001',
		'fixture-device-command-active-lock',
		NULL,
		'fixture-boot-station-01',
		'LOCK_SLOT',
		'REQUESTED',
		NULL,
		NULL,
		NULL,
		NULL,
		NULL,
		NULL,
		NULL,
		TIMESTAMP('2026-08-03 01:00:30.000000'),
		NULL,
		NULL,
		TIMESTAMP('2026-08-03 01:00:30.000000'),
		TIMESTAMP('2026-08-03 01:00:30.000000')
	),
	(
		'device-terminal',
		'99000000-0000-4000-8000-000000000002',
		'22000000-0000-4000-8000-000000000001',
		'33000000-0000-4000-8000-000000000003',
		'fixture-device-command-recovery-lock',
		'fixture-device-event-recovery-timeout',
		'fixture-boot-station-01',
		'LOCK_SLOT',
		'FAILED',
		'OPERATION_FAILED',
		'LOCK_CONFIRMATION_TIMEOUT',
		'OCCUPIED',
		'ERROR',
		1,
		TIMESTAMP('2026-08-03 02:20:00.000000'),
		JSON_OBJECT(
			'outcome', 'timeout',
			'sensor', 'lock',
			'source', 'fixture'
		),
		TIMESTAMP('2026-08-03 02:19:00.000000'),
		TIMESTAMP('2026-08-03 02:19:01.000000'),
		TIMESTAMP('2026-08-03 02:20:01.000000'),
		TIMESTAMP('2026-08-03 02:19:00.000000'),
		TIMESTAMP('2026-08-03 02:20:01.000000')
	);

CREATE TEMPORARY TABLE `_fixture_expected_face_sync` (
	`scenario_key` VARCHAR(50) NOT NULL,
	`sync_operation_id` CHAR(36) NOT NULL,
	`request_id` VARCHAR(100) NOT NULL,
	`user_ref` CHAR(36) NOT NULL,
	`operation_type` VARCHAR(50) NOT NULL,
	`template_version` INT NOT NULL,
	`sync_status` VARCHAR(30) NOT NULL,
	`last_error_code` VARCHAR(100) NULL,
	`requested_at` DATETIME(6) NOT NULL,
	`completed_at` DATETIME(6) NULL,
	`created_at` DATETIME(6) NOT NULL,
	`updated_at` DATETIME(6) NOT NULL,
	PRIMARY KEY (`sync_operation_id`),
	UNIQUE (`request_id`)
);

INSERT INTO `_fixture_expected_face_sync` VALUES (
	'face-register-succeeded',
	'aa000000-0000-4000-8000-000000000001',
	'fixture-face-register-eligible',
	'11000000-0000-4000-8000-000000000001',
	'REGISTER',
	1,
	'SUCCEEDED',
	NULL,
	TIMESTAMP('2026-08-03 00:01:00.000000'),
	TIMESTAMP('2026-08-03 00:02:00.000000'),
	TIMESTAMP('2026-08-03 00:01:00.000000'),
	TIMESTAMP('2026-08-03 00:02:00.000000')
);

CREATE TEMPORARY TABLE `_fixture_expected_slot_state` (
	`slot_id` CHAR(36) NOT NULL,
	`service_status` VARCHAR(30) NOT NULL,
	`occupancy_status` VARCHAR(30) NOT NULL,
	`lock_status` VARCHAR(30) NOT NULL,
	`item_condition` VARCHAR(50) NULL,
	`updated_at` DATETIME(6) NOT NULL,
	PRIMARY KEY (`slot_id`)
);

INSERT INTO `_fixture_expected_slot_state` VALUES
	(
		'33000000-0000-4000-8000-000000000001',
		'AVAILABLE', 'EMPTY', 'LOCKED', 'EMPTY',
		TIMESTAMP('2026-08-03 05:00:00.000000')
	),
	(
		'33000000-0000-4000-8000-000000000002',
		'AVAILABLE', 'EMPTY', 'LOCKED', 'EMPTY',
		TIMESTAMP('2026-08-03 05:00:00.000000')
	),
	(
		'33000000-0000-4000-8000-000000000003',
		'ADMIN_REVIEW', 'OCCUPIED', 'ERROR', 'UNKNOWN',
		TIMESTAMP('2026-08-03 05:00:00.000000')
	),
	(
		'33000000-0000-4000-8000-000000000004',
		'AVAILABLE', 'EMPTY', 'LOCKED', 'EMPTY',
		TIMESTAMP('2026-08-03 05:00:00.000000')
	),
	(
		'33000000-0000-4000-8000-000000000005',
		'OUT_OF_SERVICE', 'OCCUPIED', 'LOCKED', 'DAMAGED',
		TIMESTAMP('2026-08-03 05:00:00.000000')
	);

-- Prerequisites from scripts 00, 10, and 20 must exist before any business DML.
INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'prerequisite:station', 1
WHERE NOT EXISTS (
	SELECT 1
	FROM `station`
	WHERE `station_id` = '22000000-0000-4000-8000-000000000001'
);

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'prerequisite:slots', 1
WHERE (
	SELECT COUNT(*)
	FROM `slot`
	WHERE `station_id` = '22000000-0000-4000-8000-000000000001'
) <> 5;

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'prerequisite:users', 1
WHERE (
	SELECT COUNT(*)
	FROM `user_account`
	WHERE `user_id` IN (
		'202600001', '202600002', '202600003',
		'202600004', '202600005', '202600006'
	)
) <> 6;

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'prerequisite:admin', 1
WHERE NOT EXISTS (
	SELECT 1
	FROM `admin_account`
	WHERE `admin_id` = '88000000-0000-4000-8000-000000000001'
);

-- Existing fixed IDs must match the complete final fixture row.
INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('rental:', `expected`.`rental_id`), 1
FROM `_fixture_expected_rental` AS `expected`
INNER JOIN `rental` AS `actual`
	ON `actual`.`rental_id` = `expected`.`rental_id`
WHERE NOT (
	`actual`.`user_id` <=> `expected`.`user_id`
	AND `actual`.`checkout_slot_id` <=> `expected`.`checkout_slot_id`
	AND `actual`.`rental_request_id` <=> `expected`.`rental_request_id`
	AND `actual`.`status` <=> `expected`.`final_status`
	AND `actual`.`failure_code` <=> `expected`.`failure_code`
	AND `actual`.`failure_message` <=> `expected`.`failure_message`
	AND `actual`.`failed_at` <=> `expected`.`failed_at`
	AND `actual`.`requested_at` <=> `expected`.`requested_at`
	AND `actual`.`rented_at` <=> `expected`.`rented_at`
	AND `actual`.`due_at` <=> `expected`.`due_at`
	AND `actual`.`ended_at` <=> `expected`.`ended_at`
	AND `actual`.`created_at` <=> `expected`.`created_at`
	AND `actual`.`updated_at` <=> `expected`.`updated_at`
);

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('rental-request:', `actual`.`rental_id`), 1
FROM `rental` AS `actual`
INNER JOIN `_fixture_expected_rental` AS `expected`
	ON `actual`.`rental_request_id` = `expected`.`rental_request_id`
WHERE `actual`.`rental_id` <> `expected`.`rental_id`;

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('return:', `expected`.`return_attempt_id`), 1
FROM `_fixture_expected_return` AS `expected`
INNER JOIN `return_attempt` AS `actual`
	ON `actual`.`return_attempt_id` = `expected`.`return_attempt_id`
WHERE NOT (
	`actual`.`rental_id` <=> `expected`.`rental_id`
	AND `actual`.`return_slot_id` <=> `expected`.`return_slot_id`
	AND `actual`.`request_id` <=> `expected`.`request_id`
	AND `actual`.`status` <=> `expected`.`status`
	AND `actual`.`physical_completed_at` <=> `expected`.`physical_completed_at`
	AND `actual`.`completed_at` <=> `expected`.`completed_at`
	AND `actual`.`failure_reason` <=> `expected`.`failure_reason`
	AND `actual`.`created_at` <=> `expected`.`created_at`
	AND `actual`.`updated_at` <=> `expected`.`updated_at`
);

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('return-request:', `actual`.`return_attempt_id`), 1
FROM `return_attempt` AS `actual`
INNER JOIN `_fixture_expected_return` AS `expected`
	ON `actual`.`request_id` = `expected`.`request_id`
WHERE `actual`.`return_attempt_id` <> `expected`.`return_attempt_id`;

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('return-parent-presence:', `expected`.`return_attempt_id`), 1
FROM `_fixture_expected_return` AS `expected`
LEFT JOIN `rental` AS `rental_actual`
	ON `rental_actual`.`rental_id` = `expected`.`rental_id`
LEFT JOIN `return_attempt` AS `return_actual`
	ON `return_actual`.`return_attempt_id` = `expected`.`return_attempt_id`
WHERE (`rental_actual`.`rental_id` IS NULL)
	<> (`return_actual`.`return_attempt_id` IS NULL);

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('inspection:', `expected`.`inspection_id`), 1
FROM `_fixture_expected_inspection` AS `expected`
INNER JOIN `damage_inspection` AS `actual`
	ON `actual`.`inspection_id` = `expected`.`inspection_id`
WHERE NOT (
	`actual`.`return_attempt_id` <=> `expected`.`return_attempt_id`
	AND `actual`.`rental_id` <=> `expected`.`rental_id`
	AND `actual`.`request_id` <=> `expected`.`request_id`
	AND `actual`.`requested_at` <=> `expected`.`requested_at`
	AND `actual`.`status` <=> `expected`.`status`
	AND `actual`.`ai_result` <=> `expected`.`ai_result`
	AND `actual`.`confidence` <=> `expected`.`confidence`
	AND `actual`.`model_version` <=> `expected`.`model_version`
	AND `actual`.`completed_at` <=> `expected`.`completed_at`
	AND `actual`.`admin_decision` <=> `expected`.`admin_decision`
	AND `actual`.`reviewed_by` <=> `expected`.`reviewed_by`
	AND `actual`.`reviewed_at` <=> `expected`.`reviewed_at`
	AND `actual`.`created_at` <=> `expected`.`created_at`
	AND `actual`.`updated_at` <=> `expected`.`updated_at`
);

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('inspection-unique:', `actual`.`inspection_id`), 1
FROM `damage_inspection` AS `actual`
INNER JOIN `_fixture_expected_inspection` AS `expected`
	ON `actual`.`request_id` = `expected`.`request_id`
	OR `actual`.`return_attempt_id` = `expected`.`return_attempt_id`
WHERE `actual`.`inspection_id` <> `expected`.`inspection_id`;

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('inspection-parent-presence:', `expected`.`inspection_id`), 1
FROM `_fixture_expected_inspection` AS `expected`
LEFT JOIN `return_attempt` AS `return_actual`
	ON `return_actual`.`return_attempt_id` = `expected`.`return_attempt_id`
LEFT JOIN `damage_inspection` AS `inspection_actual`
	ON `inspection_actual`.`inspection_id` = `expected`.`inspection_id`
WHERE (`return_actual`.`return_attempt_id` IS NULL)
	<> (`inspection_actual`.`inspection_id` IS NULL);

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('device-operation:', `expected`.`operation_id`), 1
FROM `_fixture_expected_device_operation` AS `expected`
INNER JOIN `device_operation` AS `actual`
	ON `actual`.`operation_id` = `expected`.`operation_id`
WHERE NOT (
	`actual`.`station_id` <=> `expected`.`station_id`
	AND `actual`.`slot_id` <=> `expected`.`slot_id`
	AND `actual`.`command_id` <=> `expected`.`command_id`
	AND `actual`.`event_id` <=> `expected`.`event_id`
	AND `actual`.`issued_boot_id` <=> `expected`.`issued_boot_id`
	AND `actual`.`operation_type` <=> `expected`.`operation_type`
	AND `actual`.`status` <=> `expected`.`status`
	AND `actual`.`terminal_event_type` <=> `expected`.`terminal_event_type`
	AND `actual`.`result_code` <=> `expected`.`result_code`
	AND `actual`.`observed_occupancy_status`
		<=> `expected`.`observed_occupancy_status`
	AND `actual`.`observed_lock_status` <=> `expected`.`observed_lock_status`
	AND `actual`.`evidence_schema_version`
		<=> `expected`.`evidence_schema_version`
	AND `actual`.`evidence_observed_at` <=> `expected`.`evidence_observed_at`
	AND (
		(`actual`.`evidence_payload` IS NULL
			AND `expected`.`evidence_payload` IS NULL)
		OR (
			`actual`.`evidence_payload` IS NOT NULL
			AND `expected`.`evidence_payload` IS NOT NULL
			AND JSON_CONTAINS(
				`actual`.`evidence_payload`, `expected`.`evidence_payload`
			) = 1
			AND JSON_CONTAINS(
				`expected`.`evidence_payload`, `actual`.`evidence_payload`
			) = 1
		)
	)
	AND `actual`.`requested_at` <=> `expected`.`requested_at`
	AND `actual`.`acked_at` <=> `expected`.`acked_at`
	AND `actual`.`completed_at` <=> `expected`.`completed_at`
	AND `actual`.`created_at` <=> `expected`.`created_at`
	AND `actual`.`updated_at` <=> `expected`.`updated_at`
);

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('device-operation-unique:', `actual`.`operation_id`), 1
FROM `device_operation` AS `actual`
INNER JOIN `_fixture_expected_device_operation` AS `expected`
	ON `actual`.`command_id` = `expected`.`command_id`
	OR (
		`actual`.`event_id` IS NOT NULL
		AND `actual`.`event_id` = `expected`.`event_id`
	)
WHERE `actual`.`operation_id` <> `expected`.`operation_id`;

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('face-sync:', `expected`.`sync_operation_id`), 1
FROM `_fixture_expected_face_sync` AS `expected`
INNER JOIN `face_profile_sync_operation` AS `actual`
	ON `actual`.`sync_operation_id` = `expected`.`sync_operation_id`
WHERE NOT (
	`actual`.`request_id` <=> `expected`.`request_id`
	AND `actual`.`user_ref` <=> `expected`.`user_ref`
	AND `actual`.`operation_type` <=> `expected`.`operation_type`
	AND `actual`.`template_version` <=> `expected`.`template_version`
	AND `actual`.`sync_status` <=> `expected`.`sync_status`
	AND `actual`.`last_error_code` <=> `expected`.`last_error_code`
	AND `actual`.`requested_at` <=> `expected`.`requested_at`
	AND `actual`.`completed_at` <=> `expected`.`completed_at`
	AND `actual`.`created_at` <=> `expected`.`created_at`
	AND `actual`.`updated_at` <=> `expected`.`updated_at`
);

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('face-sync-request:', `actual`.`sync_operation_id`), 1
FROM `face_profile_sync_operation` AS `actual`
INNER JOIN `_fixture_expected_face_sync` AS `expected`
	ON `actual`.`request_id` = `expected`.`request_id`
WHERE `actual`.`sync_operation_id` <> `expected`.`sync_operation_id`;

-- Slot state may be either stage-00 neutral or the exact stage-30 final state.
INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('slot-state:', `actual`.`slot_id`), 1
FROM `_fixture_expected_slot_state` AS `expected`
INNER JOIN `slot` AS `actual`
	ON `actual`.`slot_id` = `expected`.`slot_id`
WHERE NOT (
	(
		`actual`.`service_status` <=> 'AVAILABLE'
		AND `actual`.`occupancy_status` <=> 'EMPTY'
		AND `actual`.`lock_status` <=> 'LOCKED'
		AND `actual`.`item_condition` <=> 'EMPTY'
		AND `actual`.`updated_at`
			<=> TIMESTAMP('2026-08-03 00:00:00.000000')
	)
	OR (
		`actual`.`service_status` <=> `expected`.`service_status`
		AND `actual`.`occupancy_status` <=> `expected`.`occupancy_status`
		AND `actual`.`lock_status` <=> `expected`.`lock_status`
		AND `actual`.`item_condition` <=> `expected`.`item_condition`
		AND `actual`.`updated_at` <=> `expected`.`updated_at`
	)
);

-- Track newly inserted parents so the completed-return Trigger's automatic
-- updated_at can be normalized without rewriting a pre-existing row.
CREATE TEMPORARY TABLE `_fixture_new_rental` (
	`rental_id` CHAR(36) NOT NULL PRIMARY KEY
);

INSERT INTO `_fixture_new_rental` (`rental_id`)
SELECT `expected`.`rental_id`
FROM `_fixture_expected_rental` AS `expected`
LEFT JOIN `rental` AS `actual`
	ON `actual`.`rental_id` = `expected`.`rental_id`
WHERE `actual`.`rental_id` IS NULL;

INSERT INTO `rental` (
	`rental_id`, `user_id`, `checkout_slot_id`, `rental_request_id`,
	`status`, `failure_code`, `failure_message`, `failed_at`,
	`requested_at`, `rented_at`, `due_at`, `ended_at`,
	`created_at`, `updated_at`
)
SELECT
	`expected`.`rental_id`,
	`expected`.`user_id`,
	`expected`.`checkout_slot_id`,
	`expected`.`rental_request_id`,
	`expected`.`insert_status`,
	`expected`.`failure_code`,
	`expected`.`failure_message`,
	`expected`.`failed_at`,
	`expected`.`requested_at`,
	`expected`.`rented_at`,
	`expected`.`due_at`,
	CASE
		WHEN `expected`.`insert_status` = 'RETURNING' THEN NULL
		ELSE `expected`.`ended_at`
	END,
	`expected`.`created_at`,
	`expected`.`updated_at`
FROM `_fixture_expected_rental` AS `expected`
INNER JOIN `_fixture_new_rental` AS `new_row`
	ON `new_row`.`rental_id` = `expected`.`rental_id`;

-- FAILED is inserted before the retry for the same rental. It owns no
-- claimed_rental_guard; only the later RECOVERY_REQUIRED attempt owns it.
INSERT INTO `return_attempt` (
	`return_attempt_id`, `rental_id`, `return_slot_id`, `request_id`,
	`status`, `physical_completed_at`, `completed_at`, `failure_reason`,
	`created_at`, `updated_at`
)
SELECT
	`expected`.`return_attempt_id`,
	`expected`.`rental_id`,
	`expected`.`return_slot_id`,
	`expected`.`request_id`,
	`expected`.`status`,
	`expected`.`physical_completed_at`,
	`expected`.`completed_at`,
	`expected`.`failure_reason`,
	`expected`.`created_at`,
	`expected`.`updated_at`
FROM `_fixture_expected_return` AS `expected`
LEFT JOIN `return_attempt` AS `actual`
	ON `actual`.`return_attempt_id` = `expected`.`return_attempt_id`
WHERE `actual`.`return_attempt_id` IS NULL
ORDER BY `expected`.`insert_order`;

-- COMPLETED Return Attempt insertion changes its Rental from RETURNING to
-- COMPLETED and copies completed_at to ended_at. Normalize only new parents.
UPDATE `rental` AS `actual`
INNER JOIN `_fixture_expected_rental` AS `expected`
	ON `expected`.`rental_id` = `actual`.`rental_id`
INNER JOIN `_fixture_new_rental` AS `new_row`
	ON `new_row`.`rental_id` = `actual`.`rental_id`
SET `actual`.`updated_at` = `expected`.`updated_at`
WHERE `expected`.`final_status` = 'COMPLETED';

-- Fail if the Trigger did not establish the exact final Rental state.
INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('rental-final:', `expected`.`rental_id`), 1
FROM `_fixture_expected_rental` AS `expected`
INNER JOIN `rental` AS `actual`
	ON `actual`.`rental_id` = `expected`.`rental_id`
WHERE NOT (
	`actual`.`status` <=> `expected`.`final_status`
	AND `actual`.`ended_at` <=> `expected`.`ended_at`
	AND `actual`.`updated_at` <=> `expected`.`updated_at`
);

INSERT INTO `damage_inspection` (
	`inspection_id`, `return_attempt_id`, `rental_id`, `request_id`,
	`requested_at`, `status`, `ai_result`, `confidence`, `model_version`,
	`completed_at`, `admin_decision`, `reviewed_by`, `reviewed_at`,
	`created_at`, `updated_at`
)
SELECT
	`expected`.`inspection_id`,
	`expected`.`return_attempt_id`,
	`expected`.`rental_id`,
	`expected`.`request_id`,
	`expected`.`requested_at`,
	`expected`.`status`,
	`expected`.`ai_result`,
	`expected`.`confidence`,
	`expected`.`model_version`,
	`expected`.`completed_at`,
	`expected`.`admin_decision`,
	`expected`.`reviewed_by`,
	`expected`.`reviewed_at`,
	`expected`.`created_at`,
	`expected`.`updated_at`
FROM `_fixture_expected_inspection` AS `expected`
LEFT JOIN `damage_inspection` AS `actual`
	ON `actual`.`inspection_id` = `expected`.`inspection_id`
WHERE `actual`.`inspection_id` IS NULL;

INSERT INTO `device_operation` (
	`operation_id`, `station_id`, `slot_id`, `command_id`, `event_id`,
	`issued_boot_id`, `operation_type`, `status`, `terminal_event_type`,
	`result_code`, `observed_occupancy_status`, `observed_lock_status`,
	`evidence_schema_version`, `evidence_observed_at`, `evidence_payload`,
	`requested_at`, `acked_at`, `completed_at`, `created_at`, `updated_at`
)
SELECT
	`expected`.`operation_id`,
	`expected`.`station_id`,
	`expected`.`slot_id`,
	`expected`.`command_id`,
	`expected`.`event_id`,
	`expected`.`issued_boot_id`,
	`expected`.`operation_type`,
	`expected`.`status`,
	`expected`.`terminal_event_type`,
	`expected`.`result_code`,
	`expected`.`observed_occupancy_status`,
	`expected`.`observed_lock_status`,
	`expected`.`evidence_schema_version`,
	`expected`.`evidence_observed_at`,
	`expected`.`evidence_payload`,
	`expected`.`requested_at`,
	`expected`.`acked_at`,
	`expected`.`completed_at`,
	`expected`.`created_at`,
	`expected`.`updated_at`
FROM `_fixture_expected_device_operation` AS `expected`
LEFT JOIN `device_operation` AS `actual`
	ON `actual`.`operation_id` = `expected`.`operation_id`
WHERE `actual`.`operation_id` IS NULL;

INSERT INTO `face_profile_sync_operation` (
	`sync_operation_id`, `request_id`, `user_ref`, `operation_type`,
	`template_version`, `sync_status`, `last_error_code`, `requested_at`,
	`completed_at`, `created_at`, `updated_at`
)
SELECT
	`expected`.`sync_operation_id`,
	`expected`.`request_id`,
	`expected`.`user_ref`,
	`expected`.`operation_type`,
	`expected`.`template_version`,
	`expected`.`sync_status`,
	`expected`.`last_error_code`,
	`expected`.`requested_at`,
	`expected`.`completed_at`,
	`expected`.`created_at`,
	`expected`.`updated_at`
FROM `_fixture_expected_face_sync` AS `expected`
LEFT JOIN `face_profile_sync_operation` AS `actual`
	ON `actual`.`sync_operation_id` = `expected`.`sync_operation_id`
WHERE `actual`.`sync_operation_id` IS NULL;

-- Stage 30 may transition only the exact neutral state established by stage 00.
UPDATE `slot` AS `actual`
INNER JOIN `_fixture_expected_slot_state` AS `expected`
	ON `expected`.`slot_id` = `actual`.`slot_id`
SET
	`actual`.`service_status` = `expected`.`service_status`,
	`actual`.`occupancy_status` = `expected`.`occupancy_status`,
	`actual`.`lock_status` = `expected`.`lock_status`,
	`actual`.`item_condition` = `expected`.`item_condition`,
	`actual`.`updated_at` = `expected`.`updated_at`
WHERE `actual`.`service_status` = 'AVAILABLE'
	AND `actual`.`occupancy_status` = 'EMPTY'
	AND `actual`.`lock_status` = 'LOCKED'
	AND `actual`.`item_condition` = 'EMPTY'
	AND `actual`.`updated_at`
		= TIMESTAMP('2026-08-03 00:00:00.000000');

-- Postconditions: exact row counts and cross-flow invariants.
INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'rental-count', 1
WHERE (
	SELECT COUNT(*)
	FROM `rental` AS `actual`
	INNER JOIN `_fixture_expected_rental` AS `expected`
		ON `expected`.`rental_id` = `actual`.`rental_id`
) <> 6;

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('rental-failure-shape:', `rental_id`), 1
FROM `rental`
WHERE `rental_id` IN (
	SELECT `rental_id` FROM `_fixture_expected_rental`
)
	AND (
		(
			`status` = 'FAILED'
			AND (`failure_code` IS NULL OR `failed_at` IS NULL)
		)
		OR (
			`status` <> 'FAILED'
			AND (
				`failure_code` IS NOT NULL
				OR `failure_message` IS NOT NULL
				OR `failed_at` IS NOT NULL
			)
		)
	);

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('return-slot:', `return_attempt_id`), 1
FROM `return_attempt`
WHERE `return_attempt_id` IN (
	SELECT `return_attempt_id` FROM `_fixture_expected_return`
)
	AND `status` IN ('PHYSICAL_DONE', 'COMPLETED')
	AND `return_slot_id` IS NULL;

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('return-claim:', `rental_id`), 1
FROM `return_attempt`
WHERE `return_attempt_id` IN (
	SELECT `return_attempt_id` FROM `_fixture_expected_return`
)
GROUP BY `rental_id`
HAVING SUM(`claimed_rental_guard` IS NOT NULL) > 1;

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('inspection-rental:', `inspection`.`inspection_id`), 1
FROM `damage_inspection` AS `inspection`
INNER JOIN `return_attempt` AS `return_actual`
	ON `return_actual`.`return_attempt_id` = `inspection`.`return_attempt_id`
WHERE `inspection`.`inspection_id` IN (
	SELECT `inspection_id` FROM `_fixture_expected_inspection`
)
	AND `inspection`.`rental_id` <> `return_actual`.`rental_id`;

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('inspection-ai-shape:', `inspection_id`), 1
FROM `damage_inspection`
WHERE `inspection_id` IN (
	SELECT `inspection_id` FROM `_fixture_expected_inspection`
)
	AND (
		(
			`status` = 'FAILED'
			AND (`ai_result` IS NOT NULL OR `confidence` IS NOT NULL)
		)
		OR (
			`status` = 'COMPLETED'
			AND (
				`ai_result` IS NULL
				OR `confidence` IS NULL
				OR `model_version` IS NULL
			)
		)
	);

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('device-evidence-identity:', `operation_id`), 1
FROM `device_operation`
WHERE `operation_id` IN (
	SELECT `operation_id` FROM `_fixture_expected_device_operation`
)
	AND `evidence_payload` IS NOT NULL
	AND JSON_CONTAINS_PATH(
		`evidence_payload`,
		'one',
		'$**.userId',
		'$**.user_id',
		'$**.studentNumber',
		'$**.student_number',
		'$**.studentId',
		'$**.student_id'
	) = 1;

-- V19 DEVICE_OPERATION is intentionally independent: these columns must not
-- exist, and no business relationship is encoded in evidence_payload.
INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'device-operation-business-columns', 1
WHERE (
	SELECT COUNT(*)
	FROM `information_schema`.`columns`
	WHERE `table_schema` = DATABASE()
		AND `table_name` = 'device_operation'
		AND `column_name` IN ('rental_id', 'return_attempt_id')
) <> 0;

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('request-prefix:', `rental_request_id`), 1
FROM `_fixture_expected_rental`
WHERE `rental_request_id` NOT LIKE 'fixture-%';

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('request-prefix:', `request_id`), 1
FROM `_fixture_expected_return`
WHERE `request_id` NOT LIKE 'fixture-%';

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('request-prefix:', `request_id`), 1
FROM `_fixture_expected_inspection`
WHERE `request_id` NOT LIKE 'fixture-%';

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('request-prefix:', `command_id`), 1
FROM `_fixture_expected_device_operation`
WHERE `command_id` NOT LIKE 'fixture-%'
	OR (`event_id` IS NOT NULL AND `event_id` NOT LIKE 'fixture-%');

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('request-prefix:', `request_id`), 1
FROM `_fixture_expected_face_sync`
WHERE `request_id` NOT LIKE 'fixture-%';

INSERT INTO `_fixture_30_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('slot-final:', `expected`.`slot_id`), 1
FROM `_fixture_expected_slot_state` AS `expected`
INNER JOIN `slot` AS `actual`
	ON `actual`.`slot_id` = `expected`.`slot_id`
WHERE NOT (
	`actual`.`service_status` <=> `expected`.`service_status`
	AND `actual`.`occupancy_status` <=> `expected`.`occupancy_status`
	AND `actual`.`lock_status` <=> `expected`.`lock_status`
	AND `actual`.`item_condition` <=> `expected`.`item_condition`
	AND `actual`.`updated_at` <=> `expected`.`updated_at`
);

-- Human-readable verification output for EC2 demonstrations.
SELECT
	`expected`.`scenario_key`,
	`actual`.`rental_id`,
	`actual`.`user_id`,
	`actual`.`status`,
	`actual`.`failure_code`,
	`actual`.`ended_at`
FROM `_fixture_expected_rental` AS `expected`
INNER JOIN `rental` AS `actual`
	ON `actual`.`rental_id` = `expected`.`rental_id`
ORDER BY `expected`.`rental_id`;

SELECT
	`expected`.`scenario_key`,
	`actual`.`return_attempt_id`,
	`actual`.`rental_id`,
	`actual`.`status`,
	`actual`.`return_slot_id`,
	`actual`.`claimed_rental_guard`
FROM `_fixture_expected_return` AS `expected`
INNER JOIN `return_attempt` AS `actual`
	ON `actual`.`return_attempt_id` = `expected`.`return_attempt_id`
ORDER BY `expected`.`insert_order`;

SELECT
	`expected`.`scenario_key`,
	`actual`.`inspection_id`,
	`actual`.`status`,
	`actual`.`ai_result`,
	`actual`.`confidence`,
	`actual`.`admin_decision`,
	`actual`.`reviewed_by`
FROM `_fixture_expected_inspection` AS `expected`
INNER JOIN `damage_inspection` AS `actual`
	ON `actual`.`inspection_id` = `expected`.`inspection_id`
ORDER BY `actual`.`inspection_id`;

SELECT
	`scenario_key`,
	`operation_id`,
	`command_id`,
	`event_id`,
	`status`,
	`terminal_event_type`
FROM `_fixture_expected_device_operation`
ORDER BY `operation_id`;

DROP TEMPORARY TABLE `_fixture_new_rental`;
DROP TEMPORARY TABLE `_fixture_expected_slot_state`;
DROP TEMPORARY TABLE `_fixture_expected_face_sync`;
DROP TEMPORARY TABLE `_fixture_expected_device_operation`;
DROP TEMPORARY TABLE `_fixture_expected_inspection`;
DROP TEMPORARY TABLE `_fixture_expected_return`;
DROP TEMPORARY TABLE `_fixture_expected_rental`;
DROP TEMPORARY TABLE `_fixture_30_conflict_guard`;

COMMIT;
