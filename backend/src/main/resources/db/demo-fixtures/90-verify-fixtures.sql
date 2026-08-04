-- V19 demo fixture: fail-fast verification suite.
--
-- Run after 00, 10, 20, 30, and 40 without the mysql --force option. Every
-- assertion writes only to TEMPORARY tables. A mismatch violates a named CHECK
-- constraint and stops the client before the PASS result sets are emitted.
-- No business row is inserted, updated, or deleted by this file.

CREATE TEMPORARY TABLE `_fixture_expected_record` (
	`entity_name` VARCHAR(40) NOT NULL,
	`record_id` VARCHAR(100) NOT NULL,
	PRIMARY KEY (`entity_name`, `record_id`)
);

INSERT INTO `_fixture_expected_record` VALUES
	('STATION', '22000000-0000-4000-8000-000000000001'),
	('SLOT', '33000000-0000-4000-8000-000000000001'),
	('SLOT', '33000000-0000-4000-8000-000000000002'),
	('SLOT', '33000000-0000-4000-8000-000000000003'),
	('SLOT', '33000000-0000-4000-8000-000000000004'),
	('SLOT', '33000000-0000-4000-8000-000000000005'),
	('ADMIN_ACCOUNT', '88000000-0000-4000-8000-000000000001'),
	('USER_ACCOUNT', '202600001'),
	('USER_ACCOUNT', '202600002'),
	('USER_ACCOUNT', '202600003'),
	('USER_ACCOUNT', '202600004'),
	('USER_ACCOUNT', '202600005'),
	('USER_ACCOUNT', '202600006'),
	('USER_ACCOUNT', '202600007'),
	('RENTAL', '44000000-0000-4000-8000-000000000003'),
	('RENTAL', '44000000-0000-4000-8000-000000000004'),
	('RENTAL', '44000000-0000-4000-8000-000000000005'),
	('RENTAL', '44000000-0000-4000-8000-000000000006'),
	('RENTAL', '44000000-0000-4000-8000-000000000007'),
	('RENTAL', '44000000-0000-4000-8000-000000000008'),
	('RENTAL', '44000000-0000-4000-8000-000000000009'),
	('RETURN_ATTEMPT', '55000000-0000-4000-8000-000000000002'),
	('RETURN_ATTEMPT', '55000000-0000-4000-8000-000000000003'),
	('RETURN_ATTEMPT', '55000000-0000-4000-8000-000000000004'),
	('RETURN_ATTEMPT', '55000000-0000-4000-8000-000000000006'),
	('RETURN_ATTEMPT', '55000000-0000-4000-8000-000000000007'),
	('RETURN_ATTEMPT', '55000000-0000-4000-8000-000000000008'),
	('DAMAGE_INSPECTION', '66000000-0000-4000-8000-000000000001'),
	('DAMAGE_INSPECTION', '66000000-0000-4000-8000-000000000002'),
	('DAMAGE_INSPECTION', '66000000-0000-4000-8000-000000000004'),
	('DAMAGE_INSPECTION', '66000000-0000-4000-8000-000000000005'),
	('DEVICE_OPERATION', '99000000-0000-4000-8000-000000000001'),
	('DEVICE_OPERATION', '99000000-0000-4000-8000-000000000002'),
	('FACE_PROFILE_SYNC_OPERATION', 'aa000000-0000-4000-8000-000000000001'),
	('FACE_PROFILE_SYNC_OPERATION', 'aa000000-0000-4000-8000-000000000002'),
	('FACE_PROFILE_SYNC_OPERATION', 'aa000000-0000-4000-8000-000000000003'),
	('FACE_PROFILE_SYNC_OPERATION', 'aa000000-0000-4000-8000-000000000004'),
	('FACE_PROFILE_SYNC_OPERATION', 'aa000000-0000-4000-8000-000000000005'),
	('FACE_PROFILE_SYNC_OPERATION', 'aa000000-0000-4000-8000-000000000006'),
	('SETTLEMENT', '77000000-0000-4000-8000-000000000004'),
	('SETTLEMENT', '77000000-0000-4000-8000-000000000005'),
	('SETTLEMENT', '77000000-0000-4000-8000-000000000006'),
	('SETTLEMENT', '77000000-0000-4000-8000-000000000007'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000002'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000005'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000006'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000007'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000008');

CREATE TEMPORARY TABLE `_fixture_expected_request_key` (
	`entity_name` VARCHAR(40) NOT NULL,
	`record_id` VARCHAR(100) NOT NULL,
	`key_role` VARCHAR(40) NOT NULL,
	`key_value` VARCHAR(200) NOT NULL,
	PRIMARY KEY (`entity_name`, `record_id`, `key_role`),
	UNIQUE (`key_value`)
);

INSERT INTO `_fixture_expected_request_key` VALUES
	('RENTAL', '44000000-0000-4000-8000-000000000003', 'rental_request_id', 'fixture-rental-unpaid-settlement'),
	('RENTAL', '44000000-0000-4000-8000-000000000004', 'rental_request_id', 'fixture-rental-normal-completed'),
	('RENTAL', '44000000-0000-4000-8000-000000000005', 'rental_request_id', 'fixture-rental-face-ineligible'),
	('RENTAL', '44000000-0000-4000-8000-000000000006', 'rental_request_id', 'fixture-rental-ai-failed'),
	('RENTAL', '44000000-0000-4000-8000-000000000007', 'rental_request_id', 'fixture-rental-payment-partial'),
	('RENTAL', '44000000-0000-4000-8000-000000000008', 'rental_request_id', 'fixture-rental-review-pending-completed'),
	('RENTAL', '44000000-0000-4000-8000-000000000009', 'rental_request_id', 'fixture-rental-overdue-completed'),
	('RETURN_ATTEMPT', '55000000-0000-4000-8000-000000000002', 'request_id', 'fixture-return-unpaid-completed'),
	('RETURN_ATTEMPT', '55000000-0000-4000-8000-000000000003', 'request_id', 'fixture-return-normal-completed'),
	('RETURN_ATTEMPT', '55000000-0000-4000-8000-000000000004', 'request_id', 'fixture-return-ai-failed-completed'),
	('RETURN_ATTEMPT', '55000000-0000-4000-8000-000000000006', 'request_id', 'fixture-return-payment-partial'),
	('RETURN_ATTEMPT', '55000000-0000-4000-8000-000000000007', 'request_id', 'fixture-return-review-pending-completed'),
	('RETURN_ATTEMPT', '55000000-0000-4000-8000-000000000008', 'request_id', 'fixture-return-overdue-completed'),
	('DAMAGE_INSPECTION', '66000000-0000-4000-8000-000000000001', 'request_id', 'fixture-inspection-unpaid-damage'),
	('DAMAGE_INSPECTION', '66000000-0000-4000-8000-000000000002', 'request_id', 'fixture-inspection-normal-decided'),
	('DAMAGE_INSPECTION', '66000000-0000-4000-8000-000000000004', 'request_id', 'fixture-inspection-ai-failed'),
	('DAMAGE_INSPECTION', '66000000-0000-4000-8000-000000000005', 'request_id', 'fixture-inspection-review-pending'),
	('DEVICE_OPERATION', '99000000-0000-4000-8000-000000000001', 'command_id', 'fixture-device-command-active-lock'),
	('DEVICE_OPERATION', '99000000-0000-4000-8000-000000000002', 'command_id', 'fixture-device-command-recovery-lock'),
	('DEVICE_OPERATION', '99000000-0000-4000-8000-000000000002', 'event_id', 'fixture-device-event-recovery-timeout'),
	('FACE_PROFILE_SYNC_OPERATION', 'aa000000-0000-4000-8000-000000000001', 'request_id', 'fixture-face-register-demo-01'),
	('FACE_PROFILE_SYNC_OPERATION', 'aa000000-0000-4000-8000-000000000002', 'request_id', 'fixture-face-register-demo-02'),
	('FACE_PROFILE_SYNC_OPERATION', 'aa000000-0000-4000-8000-000000000003', 'request_id', 'fixture-face-register-demo-03'),
	('FACE_PROFILE_SYNC_OPERATION', 'aa000000-0000-4000-8000-000000000004', 'request_id', 'fixture-face-register-demo-04'),
	('FACE_PROFILE_SYNC_OPERATION', 'aa000000-0000-4000-8000-000000000005', 'request_id', 'fixture-face-register-demo-05'),
	('FACE_PROFILE_SYNC_OPERATION', 'aa000000-0000-4000-8000-000000000006', 'request_id', 'fixture-face-register-demo-06'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000002', 'creation_request_id', 'fixture-payment-completed-success'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000002', 'toss_order_id', 'fixture-toss-order-completed-success'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000002', 'toss_payment_key', 'fixture-toss-key-completed-success'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000005', 'creation_request_id', 'fixture-payment-damage-success'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000005', 'toss_order_id', 'fixture-toss-order-damage-success'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000005', 'toss_payment_key', 'fixture-toss-key-damage-success'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000006', 'creation_request_id', 'fixture-payment-overdue-success'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000006', 'toss_order_id', 'fixture-toss-order-overdue-success'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000006', 'toss_payment_key', 'fixture-toss-key-overdue-success'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000007', 'creation_request_id', 'fixture-payment-baseline-failed'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000007', 'toss_order_id', 'fixture-toss-order-baseline-failed'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000007', 'toss_payment_key', 'fixture-toss-key-baseline-failed'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000008', 'creation_request_id', 'fixture-payment-after-failure-success'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000008', 'toss_order_id', 'fixture-toss-order-after-failure-success'),
	('PAYMENT_ATTEMPT', '78000000-0000-4000-8000-000000000008', 'toss_payment_key', 'fixture-toss-key-after-failure-success');

CREATE TEMPORARY TABLE `_fixture_expected_user_state` (
	`scenario_key` VARCHAR(40) NOT NULL,
	`user_id` CHAR(9) NOT NULL PRIMARY KEY,
	`user_ref` CHAR(36) NOT NULL UNIQUE,
	`name` VARCHAR(100) NOT NULL,
	`face_registered` BOOLEAN NOT NULL,
	`has_in_progress_rental` BOOLEAN NOT NULL,
	`has_recovery_required` BOOLEAN NOT NULL,
	`has_unpaid_settlement` BOOLEAN NOT NULL,
	`authority_eligible` BOOLEAN NOT NULL,
	`rental_eligible` BOOLEAN NOT NULL,
	`is_evaluated` BOOLEAN NOT NULL
);

INSERT INTO `_fixture_expected_user_state` VALUES
	('demo-user-01', '202600001', 'f6f509d4-c001-446c-b6b7-537d65a093c3', '김민준', TRUE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE),
	('demo-user-02', '202600002', 'f86a8791-c02b-4e50-b761-d9dd009909a9', '이서연', TRUE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE),
	('demo-user-03', '202600003', '0b8255a1-70e4-45af-80f2-b38e4164ea06', '박지호', TRUE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE),
	('demo-user-04', '202600004', '59b97d2b-a37d-4f75-bd33-4beb1bd3ac76', '최수아', TRUE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE),
	('demo-user-05', '202600005', 'd8a6f8d6-3c43-4789-b980-a9f6918d53b8', '정예준', TRUE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE),
	('demo-user-06', '202600006', '3650e75c-ab2b-4455-8f00-c691fd2e66fb', '강하은', TRUE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE),
	('face-unregistered', '202600007', 'bb14cac2-74d1-4b7f-a69f-aa88fcf8f55e', '얼굴 미등록 사용자', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE);

CREATE TEMPORARY TABLE `_fixture_expected_rental_state` (
	`rental_id` CHAR(36) NOT NULL PRIMARY KEY,
	`user_id` CHAR(9) NOT NULL,
	`status` VARCHAR(30) NOT NULL
);

INSERT INTO `_fixture_expected_rental_state` VALUES
	('44000000-0000-4000-8000-000000000003', '202600005', 'COMPLETED'),
	('44000000-0000-4000-8000-000000000004', '202600001', 'COMPLETED'),
	('44000000-0000-4000-8000-000000000005', '202600007', 'FAILED'),
	('44000000-0000-4000-8000-000000000006', '202600006', 'COMPLETED'),
	('44000000-0000-4000-8000-000000000007', '202600002', 'COMPLETED'),
	('44000000-0000-4000-8000-000000000008', '202600004', 'COMPLETED'),
	('44000000-0000-4000-8000-000000000009', '202600003', 'COMPLETED');

CREATE TEMPORARY TABLE `_fixture_expected_return_state` (
	`return_attempt_id` CHAR(36) NOT NULL PRIMARY KEY,
	`rental_id` CHAR(36) NOT NULL,
	`status` VARCHAR(30) NOT NULL
);

INSERT INTO `_fixture_expected_return_state` VALUES
	('55000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000003', 'COMPLETED'),
	('55000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000004', 'COMPLETED'),
	('55000000-0000-4000-8000-000000000004', '44000000-0000-4000-8000-000000000006', 'COMPLETED'),
	('55000000-0000-4000-8000-000000000006', '44000000-0000-4000-8000-000000000007', 'COMPLETED'),
	('55000000-0000-4000-8000-000000000007', '44000000-0000-4000-8000-000000000008', 'COMPLETED'),
	('55000000-0000-4000-8000-000000000008', '44000000-0000-4000-8000-000000000009', 'COMPLETED');

CREATE TEMPORARY TABLE `_fixture_expected_ai_state` (
	`inspection_id` CHAR(36) NOT NULL PRIMARY KEY,
	`return_attempt_id` CHAR(36) NOT NULL,
	`rental_id` CHAR(36) NOT NULL,
	`status` VARCHAR(30) NOT NULL,
	`ai_result` VARCHAR(50) NULL,
	`confidence` DECIMAL(5,4) NULL,
	`model_version` VARCHAR(100) NULL,
	`admin_decision` VARCHAR(50) NULL,
	`reviewed_by` CHAR(36) NULL
);

INSERT INTO `_fixture_expected_ai_state` VALUES
	('66000000-0000-4000-8000-000000000001', '55000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000003', 'COMPLETED', 'DAMAGED', 0.9700, 'fixture-ai-v1', 'DAMAGED', '88000000-0000-4000-8000-000000000001'),
	('66000000-0000-4000-8000-000000000002', '55000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000004', 'COMPLETED', 'NORMAL', 0.9900, 'fixture-ai-v1', 'NORMAL', '88000000-0000-4000-8000-000000000001'),
	('66000000-0000-4000-8000-000000000004', '55000000-0000-4000-8000-000000000004', '44000000-0000-4000-8000-000000000006', 'FAILED', NULL, NULL, NULL, NULL, NULL),
	('66000000-0000-4000-8000-000000000005', '55000000-0000-4000-8000-000000000007', '44000000-0000-4000-8000-000000000008', 'COMPLETED', 'UNCERTAIN', 0.5200, 'fixture-ai-v1', NULL, NULL);

CREATE TEMPORARY TABLE `_fixture_expected_settlement_state` (
	`settlement_id` CHAR(36) NOT NULL PRIMARY KEY,
	`user_id` CHAR(9) NOT NULL,
	`rental_id` CHAR(36) NOT NULL,
	`damage_inspection_id` CHAR(36) NULL,
	`reason` VARCHAR(50) NOT NULL,
	`amount` BIGINT UNSIGNED NOT NULL,
	`paid_amount` BIGINT UNSIGNED NOT NULL,
	`status` VARCHAR(30) NOT NULL
);

INSERT INTO `_fixture_expected_settlement_state` VALUES
	('77000000-0000-4000-8000-000000000004', '202600001', '44000000-0000-4000-8000-000000000004', NULL, 'ADJUSTMENT', 4000, 4000, 'PAID'),
	('77000000-0000-4000-8000-000000000005', '202600005', '44000000-0000-4000-8000-000000000003', '66000000-0000-4000-8000-000000000001', 'DAMAGE', 7000, 7000, 'PAID'),
	('77000000-0000-4000-8000-000000000006', '202600003', '44000000-0000-4000-8000-000000000009', NULL, 'OVERDUE', 1000, 1000, 'PAID'),
	('77000000-0000-4000-8000-000000000007', '202600002', '44000000-0000-4000-8000-000000000007', NULL, 'OVERDUE', 2000, 2000, 'PAID');

CREATE TEMPORARY TABLE `_fixture_expected_payment_state` (
	`payment_attempt_id` CHAR(36) NOT NULL PRIMARY KEY,
	`settlement_id` CHAR(36) NOT NULL,
	`amount` BIGINT UNSIGNED NOT NULL,
	`status` VARCHAR(30) NOT NULL
);

INSERT INTO `_fixture_expected_payment_state` VALUES
	('78000000-0000-4000-8000-000000000002', '77000000-0000-4000-8000-000000000004', 4000, 'SUCCEEDED'),
	('78000000-0000-4000-8000-000000000005', '77000000-0000-4000-8000-000000000005', 7000, 'SUCCEEDED'),
	('78000000-0000-4000-8000-000000000006', '77000000-0000-4000-8000-000000000006', 1000, 'SUCCEEDED'),
	('78000000-0000-4000-8000-000000000007', '77000000-0000-4000-8000-000000000007', 2000, 'FAILED'),
	('78000000-0000-4000-8000-000000000008', '77000000-0000-4000-8000-000000000007', 2000, 'SUCCEEDED');

CREATE TEMPORARY TABLE `_fixture_expected_face_sync_state` (
	`sync_operation_id` CHAR(36) NOT NULL PRIMARY KEY,
	`user_ref` CHAR(36) NOT NULL UNIQUE
);

INSERT INTO `_fixture_expected_face_sync_state` VALUES
	('aa000000-0000-4000-8000-000000000001', 'f6f509d4-c001-446c-b6b7-537d65a093c3'),
	('aa000000-0000-4000-8000-000000000002', 'f86a8791-c02b-4e50-b761-d9dd009909a9'),
	('aa000000-0000-4000-8000-000000000003', '0b8255a1-70e4-45af-80f2-b38e4164ea06'),
	('aa000000-0000-4000-8000-000000000004', '59b97d2b-a37d-4f75-bd33-4beb1bd3ac76'),
	('aa000000-0000-4000-8000-000000000005', 'd8a6f8d6-3c43-4789-b980-a9f6918d53b8'),
	('aa000000-0000-4000-8000-000000000006', '3650e75c-ab2b-4455-8f00-c691fd2e66fb');

CREATE TEMPORARY TABLE `_fixture_expected_trigger` (
	`trigger_name` VARCHAR(64) NOT NULL PRIMARY KEY
);

INSERT INTO `_fixture_expected_trigger` VALUES
	('TRG_RETURN_ATTEMPT_BEFORE_INSERT'),
	('TRG_RETURN_ATTEMPT_BEFORE_UPDATE'),
	('TRG_SETTLEMENT_BEFORE_INSERT'),
	('TRG_SETTLEMENT_PAYMENT_BEFORE_UPDATE'),
	('TRG_PAYMENT_ATTEMPT_CREDIT_INSERT'),
	('TRG_PAYMENT_ATTEMPT_CREDIT_UPDATE'),
	('TRG_PAYMENT_ATTEMPT_BEFORE_DELETE'),
	('TRG_DAMAGE_INSPECTION_REVIEW_AUDIT_BEFORE_UPDATE'),
	('TRG_SETTLEMENT_DAMAGE_BASIS_BEFORE_DELETE');

CREATE TEMPORARY TABLE `_fixture_actual_record` (
	`entity_name` VARCHAR(40) NOT NULL,
	`record_id` VARCHAR(100) NOT NULL,
	PRIMARY KEY (`entity_name`, `record_id`)
);

CREATE TEMPORARY TABLE `_fixture_actual_request_key` (
	`entity_name` VARCHAR(40) NOT NULL,
	`record_id` VARCHAR(100) NOT NULL,
	`key_role` VARCHAR(40) NOT NULL,
	`key_value` VARCHAR(200) NOT NULL,
	PRIMARY KEY (`entity_name`, `record_id`, `key_role`)
);

CREATE TEMPORARY TABLE `_fixture_user_authority` (
	`scenario_key` VARCHAR(40) NOT NULL,
	`user_id` CHAR(9) NOT NULL PRIMARY KEY,
	`user_ref` CHAR(36) NOT NULL,
	`name` VARCHAR(100) NOT NULL,
	`face_registered` BOOLEAN NOT NULL,
	`has_in_progress_rental` BOOLEAN NOT NULL,
	`has_recovery_required` BOOLEAN NOT NULL,
	`has_unpaid_settlement` BOOLEAN NOT NULL,
	`authority_eligible` BOOLEAN GENERATED ALWAYS AS (
		`face_registered`
		AND NOT `has_in_progress_rental`
		AND NOT `has_recovery_required`
		AND NOT `has_unpaid_settlement`
	) STORED,
	`rental_eligible` BOOLEAN NOT NULL,
	`rental_eligibility_evaluated_at` DATETIME(6) NULL
);

CREATE TEMPORARY TABLE `_fixture_verification_summary` (
	`metric_name` VARCHAR(40) NOT NULL PRIMARY KEY,
	`metric_value` BIGINT UNSIGNED NOT NULL
);

CREATE TEMPORARY TABLE `_fixture_verify_guard` (
	`record_key` VARCHAR(160) NOT NULL,
	`check_key` VARCHAR(40) NOT NULL,
	`must_be_zero` TINYINT NOT NULL,
	CONSTRAINT `CK_VERIFY_FIXTURE_COUNTS` CHECK (`check_key` <> 'FIXTURE_COUNTS' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_ID_FORMATS` CHECK (`check_key` <> 'ID_FORMATS' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_DUPLICATE_KEYS` CHECK (`check_key` <> 'DUPLICATE_KEYS' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_FK_ORPHANS` CHECK (`check_key` <> 'FK_ORPHANS' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_RENTAL_RETURN` CHECK (`check_key` <> 'RENTAL_RETURN' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_AI_STATE` CHECK (`check_key` <> 'AI_STATE' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_DAMAGE_BASIS` CHECK (`check_key` <> 'DAMAGE_BASIS' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_PAYMENT_TOTALS` CHECK (`check_key` <> 'PAYMENT_TOTALS' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_PROJECTION_AUTHORITY` CHECK (`check_key` <> 'PROJECTION_AUTHORITY' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_TRUE_NULL` CHECK (`check_key` <> 'TRUE_NULL' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_USER_SCENARIOS` CHECK (`check_key` <> 'USER_SCENARIOS' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_FACE_SYNC_STATE` CHECK (`check_key` <> 'FACE_SYNC_STATE' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_SCENARIO_CONTAMINATION` CHECK (`check_key` <> 'SCENARIO_CONTAMINATION' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_EVIDENCE_IDENTITY` CHECK (`check_key` <> 'EVIDENCE_IDENTITY' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_INTERNAL_GUARD` CHECK (`check_key` <> 'INTERNAL_GUARD' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_FLYWAY_VERSION` CHECK (`check_key` <> 'FLYWAY_VERSION' OR `must_be_zero` = 0),
	CONSTRAINT `CK_VERIFY_TRIGGER_SET` CHECK (`check_key` <> 'TRIGGER_SET' OR `must_be_zero` = 0)
);

START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY;

-- Collect only the reserved fixture namespace plus every row owned by a
-- fixture user or parent. Unexpected graph expansion therefore fails counts.
INSERT INTO `_fixture_actual_record`
SELECT 'STATION', `station_id`
FROM `station`
WHERE `station_id` = '22000000-0000-4000-8000-000000000001'
	OR `current_boot_id` LIKE 'fixture-%';

INSERT INTO `_fixture_actual_record`
SELECT 'SLOT', `slot_id`
FROM `slot`
WHERE `station_id` = '22000000-0000-4000-8000-000000000001'
	OR `slot_id` LIKE '33000000-%';

INSERT INTO `_fixture_actual_record`
SELECT 'ADMIN_ACCOUNT', `admin_id`
FROM `admin_account`
WHERE `admin_id` LIKE '88000000-%'
	OR `login_id` LIKE '%.fixture@billisan.test';

INSERT INTO `_fixture_actual_record`
SELECT 'USER_ACCOUNT', `user_id`
FROM `user_account`
WHERE `user_id` IN (SELECT `user_id` FROM `_fixture_expected_user_state`)
	OR `login_id` LIKE '%.fixture@billisan.test';

INSERT INTO `_fixture_actual_record`
SELECT 'RENTAL', `rental_id`
FROM `rental`
WHERE `rental_id` LIKE '44000000-%'
	OR `rental_request_id` LIKE 'fixture-%'
	OR `user_id` IN (SELECT `user_id` FROM `_fixture_expected_user_state`);

INSERT INTO `_fixture_actual_record`
SELECT 'RETURN_ATTEMPT', `return_attempt_id`
FROM `return_attempt`
WHERE `return_attempt_id` LIKE '55000000-%'
	OR `request_id` LIKE 'fixture-%'
	OR `rental_id` IN (SELECT `rental_id` FROM `_fixture_expected_rental_state`);

INSERT INTO `_fixture_actual_record`
SELECT 'DAMAGE_INSPECTION', `inspection_id`
FROM `damage_inspection`
WHERE `inspection_id` LIKE '66000000-%'
	OR `request_id` LIKE 'fixture-%'
	OR `rental_id` IN (SELECT `rental_id` FROM `_fixture_expected_rental_state`);

INSERT INTO `_fixture_actual_record`
SELECT 'DEVICE_OPERATION', `operation_id`
FROM `device_operation`
WHERE `operation_id` LIKE '99000000-%'
	OR `command_id` LIKE 'fixture-%'
	OR `event_id` LIKE 'fixture-%';

INSERT INTO `_fixture_actual_record`
SELECT 'FACE_PROFILE_SYNC_OPERATION', `sync_operation_id`
FROM `face_profile_sync_operation`
WHERE `sync_operation_id` LIKE 'aa000000-%'
	OR `request_id` LIKE 'fixture-%'
	OR `user_ref` IN (SELECT `user_ref` FROM `_fixture_expected_user_state`);

INSERT INTO `_fixture_actual_record`
SELECT 'SETTLEMENT', `settlement_id`
FROM `settlement`
WHERE `settlement_id` LIKE '77000000-%'
	OR `user_id` IN (SELECT `user_id` FROM `_fixture_expected_user_state`)
	OR `rental_id` IN (SELECT `rental_id` FROM `_fixture_expected_rental_state`);

INSERT INTO `_fixture_actual_record`
SELECT 'PAYMENT_ATTEMPT', `payment_attempt_id`
FROM `payment_attempt`
WHERE `payment_attempt_id` LIKE '78000000-%'
	OR `creation_request_id` LIKE 'fixture-%'
	OR `toss_order_id` LIKE 'fixture-%'
	OR `toss_payment_key` LIKE 'fixture-%'
	OR `settlement_id` IN (
		SELECT `settlement_id` FROM `_fixture_expected_settlement_state`
	);

INSERT INTO `_fixture_actual_request_key`
SELECT 'RENTAL', `rental`.`rental_id`, 'rental_request_id', `rental`.`rental_request_id`
FROM `rental`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'RENTAL'
	AND `record`.`record_id` = `rental`.`rental_id`;

INSERT INTO `_fixture_actual_request_key`
SELECT 'RETURN_ATTEMPT', `attempt`.`return_attempt_id`, 'request_id', `attempt`.`request_id`
FROM `return_attempt` AS `attempt`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'RETURN_ATTEMPT'
	AND `record`.`record_id` = `attempt`.`return_attempt_id`;

INSERT INTO `_fixture_actual_request_key`
SELECT 'DAMAGE_INSPECTION', `inspection`.`inspection_id`, 'request_id', `inspection`.`request_id`
FROM `damage_inspection` AS `inspection`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'DAMAGE_INSPECTION'
	AND `record`.`record_id` = `inspection`.`inspection_id`;

INSERT INTO `_fixture_actual_request_key`
SELECT 'DEVICE_OPERATION', `operation`.`operation_id`, 'command_id', `operation`.`command_id`
FROM `device_operation` AS `operation`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'DEVICE_OPERATION'
	AND `record`.`record_id` = `operation`.`operation_id`;

INSERT INTO `_fixture_actual_request_key`
SELECT 'DEVICE_OPERATION', `operation`.`operation_id`, 'event_id', `operation`.`event_id`
FROM `device_operation` AS `operation`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'DEVICE_OPERATION'
	AND `record`.`record_id` = `operation`.`operation_id`
WHERE `operation`.`event_id` IS NOT NULL;

INSERT INTO `_fixture_actual_request_key`
SELECT 'FACE_PROFILE_SYNC_OPERATION', `operation`.`sync_operation_id`, 'request_id', `operation`.`request_id`
FROM `face_profile_sync_operation` AS `operation`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'FACE_PROFILE_SYNC_OPERATION'
	AND `record`.`record_id` = `operation`.`sync_operation_id`;

INSERT INTO `_fixture_actual_request_key`
SELECT 'PAYMENT_ATTEMPT', `payment`.`payment_attempt_id`, 'creation_request_id', `payment`.`creation_request_id`
FROM `payment_attempt` AS `payment`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'PAYMENT_ATTEMPT'
	AND `record`.`record_id` = `payment`.`payment_attempt_id`;

INSERT INTO `_fixture_actual_request_key`
SELECT 'PAYMENT_ATTEMPT', `payment`.`payment_attempt_id`, 'toss_order_id', `payment`.`toss_order_id`
FROM `payment_attempt` AS `payment`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'PAYMENT_ATTEMPT'
	AND `record`.`record_id` = `payment`.`payment_attempt_id`
WHERE `payment`.`toss_order_id` IS NOT NULL;

INSERT INTO `_fixture_actual_request_key`
SELECT 'PAYMENT_ATTEMPT', `payment`.`payment_attempt_id`, 'toss_payment_key', `payment`.`toss_payment_key`
FROM `payment_attempt` AS `payment`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'PAYMENT_ATTEMPT'
	AND `record`.`record_id` = `payment`.`payment_attempt_id`
WHERE `payment`.`toss_payment_key` IS NOT NULL;

INSERT INTO `_fixture_user_authority` (
	`scenario_key`, `user_id`, `user_ref`, `name`, `face_registered`,
	`has_in_progress_rental`, `has_recovery_required`,
	`has_unpaid_settlement`, `rental_eligible`,
	`rental_eligibility_evaluated_at`
)
SELECT
	`expected`.`scenario_key`,
	`user`.`user_id`,
	`user`.`user_ref`,
	`user`.`name`,
	`user`.`face_registered`,
	EXISTS (
		SELECT 1
		FROM `rental`
		WHERE `rental`.`user_id` = `user`.`user_id`
			AND `rental`.`status` IN ('REQUESTED', 'ACTIVE', 'RETURNING')
	),
	EXISTS (
		SELECT 1
		FROM `return_attempt`
		INNER JOIN `rental`
			ON `rental`.`rental_id` = `return_attempt`.`rental_id`
		WHERE `rental`.`user_id` = `user`.`user_id`
			AND `return_attempt`.`status` = 'RECOVERY_REQUIRED'
	),
	EXISTS (
		SELECT 1
		FROM `settlement`
		WHERE `settlement`.`user_id` = `user`.`user_id`
			AND `settlement`.`amount` > `settlement`.`paid_amount`
	),
	`user`.`rental_eligible`,
	`user`.`rental_eligibility_evaluated_at`
FROM `_fixture_expected_user_state` AS `expected`
INNER JOIN `user_account` AS `user`
	ON `user`.`user_id` = `expected`.`user_id`;

-- Exact fixture graph and per-entity row counts.
INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('missing:', `expected`.`entity_name`, ':', `expected`.`record_id`), 'FIXTURE_COUNTS', 1
FROM `_fixture_expected_record` AS `expected`
LEFT JOIN `_fixture_actual_record` AS `actual`
	ON `actual`.`entity_name` = `expected`.`entity_name`
	AND `actual`.`record_id` = `expected`.`record_id`
WHERE `actual`.`record_id` IS NULL;

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('unexpected:', `actual`.`entity_name`, ':', `actual`.`record_id`), 'FIXTURE_COUNTS', 1
FROM `_fixture_actual_record` AS `actual`
LEFT JOIN `_fixture_expected_record` AS `expected`
	ON `expected`.`entity_name` = `actual`.`entity_name`
	AND `expected`.`record_id` = `actual`.`record_id`
WHERE `expected`.`record_id` IS NULL;

-- UUID-bearing primary IDs and user_ref must be lowercase canonical strings;
-- student-number ownership columns must remain exactly nine digits.
INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('uuid:', `identifier`), 'ID_FORMATS', 1
FROM (
	SELECT `record_id` AS `identifier`
	FROM `_fixture_actual_record`
	WHERE `entity_name` <> 'USER_ACCOUNT'
	UNION ALL
	SELECT `user_ref`
	FROM `_fixture_user_authority`
) AS `uuid_value`
WHERE NOT REGEXP_LIKE(
	`identifier`,
	'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
	'c'
);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('student-number:', `user_id`), 'ID_FORMATS', 1
FROM `_fixture_user_authority`
WHERE NOT REGEXP_LIKE(`user_id`, '^[0-9]{9}$', 'c');

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('student-number:', `rental`.`user_id`), 'ID_FORMATS', 1
FROM `rental`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'RENTAL'
	AND `record`.`record_id` = `rental`.`rental_id`
WHERE NOT REGEXP_LIKE(`rental`.`user_id`, '^[0-9]{9}$', 'c');

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('student-number:', `settlement`.`user_id`), 'ID_FORMATS', 1
FROM `settlement`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'SETTLEMENT'
	AND `record`.`record_id` = `settlement`.`settlement_id`
WHERE NOT REGEXP_LIKE(`settlement`.`user_id`, '^[0-9]{9}$', 'c');

-- No primary identifier is reused across fixture entity types, and every
-- request/deduplication/provider key is exact, prefixed, and globally unique.
INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('duplicate-id:', MIN(`identifier`)), 'DUPLICATE_KEYS', 1
FROM (
	SELECT `record_id` AS `identifier`
	FROM `_fixture_actual_record`
	WHERE `entity_name` <> 'USER_ACCOUNT'
	UNION ALL
	SELECT `user_ref`
	FROM `_fixture_user_authority`
) AS `identifier_value`
GROUP BY CAST(`identifier` AS BINARY)
HAVING COUNT(*) <> 1;

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('duplicate-request:', MIN(`key_value`)), 'DUPLICATE_KEYS', 1
FROM `_fixture_actual_request_key`
GROUP BY CAST(`key_value` AS BINARY)
HAVING COUNT(*) <> 1;

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('missing-request:', `expected`.`entity_name`, ':', `expected`.`record_id`, ':', `expected`.`key_role`), 'DUPLICATE_KEYS', 1
FROM `_fixture_expected_request_key` AS `expected`
LEFT JOIN `_fixture_actual_request_key` AS `actual`
	ON `actual`.`entity_name` = `expected`.`entity_name`
	AND `actual`.`record_id` = `expected`.`record_id`
	AND `actual`.`key_role` = `expected`.`key_role`
	AND BINARY `actual`.`key_value` = BINARY `expected`.`key_value`
WHERE `actual`.`record_id` IS NULL;

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('unexpected-request:', `actual`.`entity_name`, ':', `actual`.`record_id`, ':', `actual`.`key_role`), 'DUPLICATE_KEYS', 1
FROM `_fixture_actual_request_key` AS `actual`
LEFT JOIN `_fixture_expected_request_key` AS `expected`
	ON `expected`.`entity_name` = `actual`.`entity_name`
	AND `expected`.`record_id` = `actual`.`record_id`
	AND `expected`.`key_role` = `actual`.`key_role`
	AND BINARY `expected`.`key_value` = BINARY `actual`.`key_value`
WHERE `expected`.`record_id` IS NULL
	OR `actual`.`key_value` NOT LIKE 'fixture-%';

-- Baseline verification must never pass after a state-changing Scenario has
-- been applied. Scenario request keys and reserved Scenario UUID namespaces
-- are rejected explicitly, in addition to the exact graph comparison above.
INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('scenario-request:', `entity_name`, ':', `record_id`, ':', `key_value`), 'SCENARIO_CONTAMINATION', 1
FROM `_fixture_actual_request_key`
WHERE `key_value` LIKE 'fixture-scenario-%';

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('scenario-id:', `entity_name`, ':', `record_id`), 'SCENARIO_CONTAMINATION', 1
FROM `_fixture_actual_record`
WHERE REGEXP_LIKE(`record_id`, '^(b3|c4)[0-9a-f]{6}-', 'c');

-- Explicit orphan checks make the relationship contract visible even though
-- the same graph is also protected by foreign keys.
INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('slot:', `slot`.`slot_id`), 'FK_ORPHANS', 1
FROM `slot`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'SLOT' AND `record`.`record_id` = `slot`.`slot_id`
LEFT JOIN `station` ON `station`.`station_id` = `slot`.`station_id`
WHERE `station`.`station_id` IS NULL;

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('rental:', `rental`.`rental_id`), 'FK_ORPHANS', 1
FROM `rental`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'RENTAL' AND `record`.`record_id` = `rental`.`rental_id`
LEFT JOIN `user_account` ON `user_account`.`user_id` = `rental`.`user_id`
LEFT JOIN `slot` ON `slot`.`slot_id` = `rental`.`checkout_slot_id`
WHERE `user_account`.`user_id` IS NULL OR `slot`.`slot_id` IS NULL;

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('return:', `attempt`.`return_attempt_id`), 'FK_ORPHANS', 1
FROM `return_attempt` AS `attempt`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'RETURN_ATTEMPT' AND `record`.`record_id` = `attempt`.`return_attempt_id`
LEFT JOIN `rental` ON `rental`.`rental_id` = `attempt`.`rental_id`
LEFT JOIN `slot` ON `slot`.`slot_id` = `attempt`.`return_slot_id`
WHERE `rental`.`rental_id` IS NULL
	OR (`attempt`.`return_slot_id` IS NOT NULL AND `slot`.`slot_id` IS NULL);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('inspection:', `inspection`.`inspection_id`), 'FK_ORPHANS', 1
FROM `damage_inspection` AS `inspection`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'DAMAGE_INSPECTION' AND `record`.`record_id` = `inspection`.`inspection_id`
LEFT JOIN `return_attempt` AS `attempt` ON `attempt`.`return_attempt_id` = `inspection`.`return_attempt_id`
LEFT JOIN `rental` ON `rental`.`rental_id` = `inspection`.`rental_id`
LEFT JOIN `admin_account` ON `admin_account`.`admin_id` = `inspection`.`reviewed_by`
WHERE `attempt`.`return_attempt_id` IS NULL OR `rental`.`rental_id` IS NULL
	OR (`inspection`.`reviewed_by` IS NOT NULL AND `admin_account`.`admin_id` IS NULL);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('device:', `operation`.`operation_id`), 'FK_ORPHANS', 1
FROM `device_operation` AS `operation`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'DEVICE_OPERATION' AND `record`.`record_id` = `operation`.`operation_id`
LEFT JOIN `station` ON `station`.`station_id` = `operation`.`station_id`
LEFT JOIN `slot` ON `slot`.`slot_id` = `operation`.`slot_id`
WHERE `station`.`station_id` IS NULL
	OR (`operation`.`slot_id` IS NOT NULL AND `slot`.`slot_id` IS NULL);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('face-sync:', `operation`.`sync_operation_id`), 'FK_ORPHANS', 1
FROM `face_profile_sync_operation` AS `operation`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'FACE_PROFILE_SYNC_OPERATION' AND `record`.`record_id` = `operation`.`sync_operation_id`
LEFT JOIN `user_account` ON `user_account`.`user_ref` = `operation`.`user_ref`
WHERE `user_account`.`user_ref` IS NULL;

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('face-sync-state:', `expected`.`sync_operation_id`), 'FACE_SYNC_STATE', 1
FROM `_fixture_expected_face_sync_state` AS `expected`
LEFT JOIN `face_profile_sync_operation` AS `actual`
	ON `actual`.`sync_operation_id` = `expected`.`sync_operation_id`
WHERE `actual`.`sync_operation_id` IS NULL
	OR NOT (
		`actual`.`user_ref` <=> `expected`.`user_ref`
		AND `actual`.`operation_type` <=> 'REGISTER'
		AND `actual`.`template_version` <=> 1
		AND `actual`.`sync_status` <=> 'SUCCEEDED'
		AND `actual`.`last_error_code` IS NULL
		AND `actual`.`requested_at` IS NOT NULL
		AND `actual`.`completed_at` IS NOT NULL
		AND `actual`.`requested_at` <= `actual`.`completed_at`
	);

INSERT INTO `_fixture_verify_guard`
SELECT 'face-sync-unregistered-user', 'FACE_SYNC_STATE', 1
WHERE EXISTS (
	SELECT 1
	FROM `face_profile_sync_operation`
	WHERE `user_ref` = 'bb14cac2-74d1-4b7f-a69f-aa88fcf8f55e'
		AND `operation_type` = 'REGISTER'
		AND `sync_status` = 'SUCCEEDED'
);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('settlement:', `settlement`.`settlement_id`), 'FK_ORPHANS', 1
FROM `settlement`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'SETTLEMENT' AND `record`.`record_id` = `settlement`.`settlement_id`
LEFT JOIN `user_account` ON `user_account`.`user_id` = `settlement`.`user_id`
LEFT JOIN `rental` ON `rental`.`rental_id` = `settlement`.`rental_id`
	AND `rental`.`user_id` = `settlement`.`user_id`
LEFT JOIN `damage_inspection` AS `inspection`
	ON `inspection`.`inspection_id` = `settlement`.`damage_inspection_id`
WHERE `user_account`.`user_id` IS NULL OR `rental`.`rental_id` IS NULL
	OR (`settlement`.`damage_inspection_id` IS NOT NULL AND `inspection`.`inspection_id` IS NULL);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('payment:', `payment`.`payment_attempt_id`), 'FK_ORPHANS', 1
FROM `payment_attempt` AS `payment`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'PAYMENT_ATTEMPT' AND `record`.`record_id` = `payment`.`payment_attempt_id`
LEFT JOIN `settlement` ON `settlement`.`settlement_id` = `payment`.`settlement_id`
WHERE `settlement`.`settlement_id` IS NULL;

-- Exact scenario states plus temporal/state completeness for Rental and Return.
INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('rental-state:', `expected`.`rental_id`), 'RENTAL_RETURN', 1
FROM `_fixture_expected_rental_state` AS `expected`
LEFT JOIN `rental` AS `actual` ON `actual`.`rental_id` = `expected`.`rental_id`
WHERE `actual`.`rental_id` IS NULL
	OR NOT (`actual`.`user_id` <=> `expected`.`user_id` AND `actual`.`status` <=> `expected`.`status`);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('rental-time:', `rental`.`rental_id`), 'RENTAL_RETURN', 1
FROM `rental`
INNER JOIN `_fixture_expected_rental_state` AS `expected` ON `expected`.`rental_id` = `rental`.`rental_id`
WHERE `rental`.`created_at` > `rental`.`requested_at`
	OR `rental`.`updated_at` < `rental`.`created_at`
	OR (`rental`.`rented_at` IS NOT NULL AND `rental`.`rented_at` < `rental`.`requested_at`)
	OR (`rental`.`due_at` IS NOT NULL AND (`rental`.`rented_at` IS NULL OR `rental`.`due_at` < `rental`.`rented_at`))
	OR (`rental`.`ended_at` IS NOT NULL AND (`rental`.`rented_at` IS NULL OR `rental`.`ended_at` < `rental`.`rented_at`))
	OR (`rental`.`status` = 'ACTIVE' AND (`rental`.`rented_at` IS NULL OR `rental`.`due_at` IS NULL OR `rental`.`ended_at` IS NOT NULL))
	OR (`rental`.`status` = 'RETURNING' AND (`rental`.`rented_at` IS NULL OR `rental`.`due_at` IS NULL OR `rental`.`ended_at` IS NOT NULL))
	OR (`rental`.`status` = 'COMPLETED' AND (`rental`.`rented_at` IS NULL OR `rental`.`due_at` IS NULL OR `rental`.`ended_at` IS NULL))
	OR (`rental`.`status` = 'FAILED' AND (`rental`.`failure_code` IS NULL OR `rental`.`failure_message` IS NULL OR `rental`.`failed_at` IS NULL))
	OR (`rental`.`status` <> 'FAILED' AND (`rental`.`failure_code` IS NOT NULL OR `rental`.`failure_message` IS NOT NULL OR `rental`.`failed_at` IS NOT NULL));

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('return-state:', `expected`.`return_attempt_id`), 'RENTAL_RETURN', 1
FROM `_fixture_expected_return_state` AS `expected`
LEFT JOIN `return_attempt` AS `actual` ON `actual`.`return_attempt_id` = `expected`.`return_attempt_id`
WHERE `actual`.`return_attempt_id` IS NULL
	OR NOT (`actual`.`rental_id` <=> `expected`.`rental_id` AND `actual`.`status` <=> `expected`.`status`);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('return-time:', `attempt`.`return_attempt_id`), 'RENTAL_RETURN', 1
FROM `return_attempt` AS `attempt`
INNER JOIN `_fixture_expected_return_state` AS `expected` ON `expected`.`return_attempt_id` = `attempt`.`return_attempt_id`
WHERE `attempt`.`updated_at` < `attempt`.`created_at`
	OR (`attempt`.`physical_completed_at` IS NOT NULL AND `attempt`.`physical_completed_at` < `attempt`.`created_at`)
	OR (`attempt`.`completed_at` IS NOT NULL AND (`attempt`.`physical_completed_at` IS NULL OR `attempt`.`completed_at` < `attempt`.`physical_completed_at`))
	OR (`attempt`.`status` = 'PROCESSING' AND (`attempt`.`physical_completed_at` IS NOT NULL OR `attempt`.`completed_at` IS NOT NULL OR `attempt`.`failure_reason` IS NOT NULL))
	OR (`attempt`.`status` = 'PHYSICAL_DONE' AND (`attempt`.`return_slot_id` IS NULL OR `attempt`.`physical_completed_at` IS NULL OR `attempt`.`completed_at` IS NOT NULL OR `attempt`.`failure_reason` IS NOT NULL))
	OR (`attempt`.`status` = 'COMPLETED' AND (`attempt`.`return_slot_id` IS NULL OR `attempt`.`physical_completed_at` IS NULL OR `attempt`.`completed_at` IS NULL OR `attempt`.`failure_reason` IS NOT NULL))
	OR (`attempt`.`status` = 'RECOVERY_REQUIRED' AND (`attempt`.`return_slot_id` IS NULL OR `attempt`.`physical_completed_at` IS NULL OR `attempt`.`completed_at` IS NOT NULL OR `attempt`.`failure_reason` IS NULL))
	OR (`attempt`.`status` = 'FAILED' AND (`attempt`.`completed_at` IS NOT NULL OR `attempt`.`failure_reason` IS NULL))
	OR (`attempt`.`status` <> 'FAILED' AND NOT (`attempt`.`claimed_rental_guard` <=> `attempt`.`rental_id`))
	OR (`attempt`.`status` = 'FAILED' AND `attempt`.`claimed_rental_guard` IS NOT NULL);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('completed-link:', `attempt`.`return_attempt_id`), 'RENTAL_RETURN', 1
FROM `return_attempt` AS `attempt`
INNER JOIN `_fixture_expected_return_state` AS `expected` ON `expected`.`return_attempt_id` = `attempt`.`return_attempt_id`
INNER JOIN `rental` ON `rental`.`rental_id` = `attempt`.`rental_id`
WHERE (`attempt`.`status` = 'COMPLETED' AND (`rental`.`status` <> 'COMPLETED' OR NOT (`rental`.`ended_at` <=> `attempt`.`completed_at`)))
	OR (`attempt`.`status` = 'RECOVERY_REQUIRED' AND (`rental`.`status` <> 'RETURNING' OR `rental`.`ended_at` IS NOT NULL));

-- AI state/result completeness, exact scenario results, and cross-flow Rental.
INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('ai-exact:', `expected`.`inspection_id`), 'AI_STATE', 1
FROM `_fixture_expected_ai_state` AS `expected`
LEFT JOIN `damage_inspection` AS `actual` ON `actual`.`inspection_id` = `expected`.`inspection_id`
WHERE `actual`.`inspection_id` IS NULL
	OR NOT (
		`actual`.`return_attempt_id` <=> `expected`.`return_attempt_id`
		AND `actual`.`rental_id` <=> `expected`.`rental_id`
		AND `actual`.`status` <=> `expected`.`status`
		AND `actual`.`ai_result` <=> `expected`.`ai_result`
		AND `actual`.`confidence` <=> `expected`.`confidence`
		AND `actual`.`model_version` <=> `expected`.`model_version`
		AND `actual`.`admin_decision` <=> `expected`.`admin_decision`
		AND `actual`.`reviewed_by` <=> `expected`.`reviewed_by`
	);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('ai-completeness:', `inspection`.`inspection_id`), 'AI_STATE', 1
FROM `damage_inspection` AS `inspection`
INNER JOIN `_fixture_expected_ai_state` AS `expected` ON `expected`.`inspection_id` = `inspection`.`inspection_id`
INNER JOIN `return_attempt` AS `attempt` ON `attempt`.`return_attempt_id` = `inspection`.`return_attempt_id`
WHERE `inspection`.`rental_id` <> `attempt`.`rental_id`
	OR `inspection`.`updated_at` < `inspection`.`created_at`
	OR `inspection`.`requested_at` < `inspection`.`created_at`
	OR (`inspection`.`completed_at` IS NOT NULL AND `inspection`.`completed_at` < `inspection`.`requested_at`)
	OR (`inspection`.`status` = 'FAILED' AND (`inspection`.`ai_result` IS NOT NULL OR `inspection`.`confidence` IS NOT NULL OR `inspection`.`model_version` IS NOT NULL OR `inspection`.`completed_at` IS NULL))
	OR (`inspection`.`status` = 'COMPLETED' AND (`inspection`.`ai_result` IS NULL OR `inspection`.`confidence` IS NULL OR `inspection`.`model_version` IS NULL OR `inspection`.`completed_at` IS NULL))
	OR ((`inspection`.`admin_decision` IS NULL OR `inspection`.`reviewed_by` IS NULL OR `inspection`.`reviewed_at` IS NULL) AND NOT (`inspection`.`admin_decision` IS NULL AND `inspection`.`reviewed_by` IS NULL AND `inspection`.`reviewed_at` IS NULL))
	OR (`inspection`.`reviewed_at` IS NOT NULL AND (`inspection`.`status` <> 'COMPLETED' OR `inspection`.`reviewed_at` < `inspection`.`completed_at`));

-- DAMAGE Settlement must point directly to the same Rental's completed,
-- administrator-reviewed DAMAGED inspection and use the fixed 7,000 amount.
INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('settlement-exact:', `expected`.`settlement_id`), 'DAMAGE_BASIS', 1
FROM `_fixture_expected_settlement_state` AS `expected`
LEFT JOIN `settlement` AS `actual` ON `actual`.`settlement_id` = `expected`.`settlement_id`
WHERE `actual`.`settlement_id` IS NULL
	OR NOT (
		`actual`.`user_id` <=> `expected`.`user_id`
		AND `actual`.`rental_id` <=> `expected`.`rental_id`
		AND `actual`.`damage_inspection_id` <=> `expected`.`damage_inspection_id`
		AND `actual`.`reason` <=> `expected`.`reason`
		AND `actual`.`amount` <=> `expected`.`amount`
		AND `actual`.`paid_amount` <=> `expected`.`paid_amount`
		AND `actual`.`status` <=> `expected`.`status`
	);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('damage-basis:', `settlement`.`settlement_id`), 'DAMAGE_BASIS', 1
FROM `settlement`
INNER JOIN `_fixture_expected_settlement_state` AS `expected` ON `expected`.`settlement_id` = `settlement`.`settlement_id`
LEFT JOIN `damage_inspection` AS `inspection` ON `inspection`.`inspection_id` = `settlement`.`damage_inspection_id`
WHERE (`settlement`.`reason` IN ('DAMAGE', 'LOSS') AND (
	`settlement`.`amount` <> 7000
	OR `settlement`.`damage_inspection_id` IS NULL
	OR `inspection`.`inspection_id` IS NULL
	OR `inspection`.`rental_id` <> `settlement`.`rental_id`
	OR `inspection`.`status` <> 'COMPLETED'
	OR `inspection`.`admin_decision` <> 'DAMAGED'
	OR `inspection`.`reviewed_by` IS NULL
	OR `inspection`.`reviewed_at` IS NULL
))
	OR (`settlement`.`reason` NOT IN ('DAMAGE', 'LOSS') AND `settlement`.`damage_inspection_id` IS NOT NULL);

-- Only immutable SUCCEEDED attempts contribute credit, and Settlement status
-- and paid_at must agree with the materialized total.
INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('payment-exact:', `expected`.`payment_attempt_id`), 'PAYMENT_TOTALS', 1
FROM `_fixture_expected_payment_state` AS `expected`
LEFT JOIN `payment_attempt` AS `actual` ON `actual`.`payment_attempt_id` = `expected`.`payment_attempt_id`
WHERE `actual`.`payment_attempt_id` IS NULL
	OR NOT (
		`actual`.`settlement_id` <=> `expected`.`settlement_id`
		AND `actual`.`amount` <=> `expected`.`amount`
		AND `actual`.`status` <=> `expected`.`status`
	);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('payment-total:', `settlement`.`settlement_id`), 'PAYMENT_TOTALS', 1
FROM `settlement`
INNER JOIN `_fixture_expected_settlement_state` AS `expected` ON `expected`.`settlement_id` = `settlement`.`settlement_id`
LEFT JOIN (
	SELECT `payment_attempt`.`settlement_id`, SUM(`payment_attempt`.`amount`) AS `succeeded_amount`
	FROM `payment_attempt`
	WHERE `payment_attempt`.`status` = 'SUCCEEDED'
	GROUP BY `payment_attempt`.`settlement_id`
) AS `credit` ON `credit`.`settlement_id` = `settlement`.`settlement_id`
WHERE `settlement`.`paid_amount` <> COALESCE(`credit`.`succeeded_amount`, 0)
	OR (`settlement`.`paid_amount` < `settlement`.`amount` AND (`settlement`.`status` <> 'PENDING' OR `settlement`.`paid_at` IS NOT NULL))
	OR (`settlement`.`paid_amount` = `settlement`.`amount` AND (`settlement`.`status` <> 'PAID' OR `settlement`.`paid_at` IS NULL));

-- Evaluated projections must equal the authoritative query used by Spring.
INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('projection:', `user_id`), 'PROJECTION_AUTHORITY', 1
FROM `_fixture_user_authority`
WHERE (`rental_eligibility_evaluated_at` IS NOT NULL AND NOT (`rental_eligible` <=> `authority_eligible`))
	OR (`rental_eligibility_evaluated_at` IS NULL AND `rental_eligible` <> FALSE);

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('true-null:', `user_id`), 'TRUE_NULL', 1
FROM `user_account`
WHERE `rental_eligible` = TRUE
	AND `rental_eligibility_evaluated_at` IS NULL;

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('user-scenario:', `expected`.`user_id`), 'USER_SCENARIOS', 1
FROM `_fixture_expected_user_state` AS `expected`
LEFT JOIN `_fixture_user_authority` AS `actual` ON `actual`.`user_id` = `expected`.`user_id`
WHERE `actual`.`user_id` IS NULL
	OR NOT (
		`actual`.`user_ref` <=> `expected`.`user_ref`
		AND BINARY `actual`.`name` <=> BINARY `expected`.`name`
		AND `actual`.`face_registered` <=> `expected`.`face_registered`
		AND `actual`.`has_in_progress_rental` <=> `expected`.`has_in_progress_rental`
		AND `actual`.`has_recovery_required` <=> `expected`.`has_recovery_required`
		AND `actual`.`has_unpaid_settlement` <=> `expected`.`has_unpaid_settlement`
		AND `actual`.`authority_eligible` <=> `expected`.`authority_eligible`
		AND `actual`.`rental_eligible` <=> `expected`.`rental_eligible`
		AND (`actual`.`rental_eligibility_evaluated_at` IS NOT NULL) <=> `expected`.`is_evaluated`
	);

INSERT INTO `_fixture_verify_guard`
SELECT 'user-population', 'USER_SCENARIOS', 1
WHERE (SELECT COUNT(*) FROM `_fixture_user_authority`) <> 7
	OR (SELECT COUNT(*) FROM `_fixture_user_authority` WHERE `face_registered` = TRUE) <> 6
	OR (SELECT COUNT(*) FROM `_fixture_user_authority` WHERE `face_registered` = FALSE) <> 1;

-- Reject both forbidden identity-shaped JSON keys and any fixture student
-- number appearing as a JSON string or number under an unrelated key.
INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('identity-key:', `operation`.`operation_id`), 'EVIDENCE_IDENTITY', 1
FROM `device_operation` AS `operation`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'DEVICE_OPERATION' AND `record`.`record_id` = `operation`.`operation_id`
WHERE `operation`.`evidence_payload` IS NOT NULL
	AND JSON_CONTAINS_PATH(
		`operation`.`evidence_payload`, 'one',
		'$**.userId', '$**.user_id', '$**.studentNumber',
		'$**.student_number', '$**.studentId', '$**.student_id'
	) = 1;

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('student-number-value:', `operation`.`operation_id`, ':', `user`.`user_id`), 'EVIDENCE_IDENTITY', 1
FROM `device_operation` AS `operation`
INNER JOIN `_fixture_actual_record` AS `record`
	ON `record`.`entity_name` = 'DEVICE_OPERATION' AND `record`.`record_id` = `operation`.`operation_id`
CROSS JOIN `_fixture_expected_user_state` AS `user`
WHERE `operation`.`evidence_payload` IS NOT NULL
	AND REGEXP_LIKE(
		CAST(`operation`.`evidence_payload` AS CHAR),
		CONCAT('(^|[^0-9])', `user`.`user_id`, '([^0-9]|$)'),
		'c'
	);

INSERT INTO `_fixture_verify_guard`
SELECT 'settlement-payment-mutation-guard', 'INTERNAL_GUARD', 1
WHERE (SELECT COUNT(*) FROM `settlement_payment_mutation_guard`) <> 0;

INSERT INTO `_fixture_verify_guard`
SELECT 'flyway-highest-version', 'FLYWAY_VERSION', 1
WHERE NOT (
	(
		SELECT MAX(CAST(`version` AS UNSIGNED))
		FROM `flyway_schema_history`
		WHERE `success` = 1
			AND REGEXP_LIKE(`version`, '^[0-9]+$', 'c')
	) <=> 19
)
	OR (
		SELECT COUNT(*)
		FROM `flyway_schema_history`
		WHERE `version` = '19' AND `success` = 1
	) <> 1;

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('missing-trigger:', `expected`.`trigger_name`), 'TRIGGER_SET', 1
FROM `_fixture_expected_trigger` AS `expected`
LEFT JOIN `information_schema`.`TRIGGERS` AS `actual`
	ON `actual`.`TRIGGER_SCHEMA` = DATABASE()
	AND BINARY `actual`.`TRIGGER_NAME` = BINARY `expected`.`trigger_name`
WHERE `actual`.`TRIGGER_NAME` IS NULL;

INSERT INTO `_fixture_verify_guard`
SELECT CONCAT('unexpected-trigger:', `actual`.`TRIGGER_NAME`), 'TRIGGER_SET', 1
FROM `information_schema`.`TRIGGERS` AS `actual`
LEFT JOIN `_fixture_expected_trigger` AS `expected`
	ON BINARY `expected`.`trigger_name` = BINARY `actual`.`TRIGGER_NAME`
WHERE `actual`.`TRIGGER_SCHEMA` = DATABASE()
	AND `expected`.`trigger_name` IS NULL;

INSERT INTO `_fixture_verify_guard`
SELECT 'trigger-count', 'TRIGGER_SET', 1
WHERE (
	SELECT COUNT(*)
	FROM `information_schema`.`TRIGGERS`
	WHERE `TRIGGER_SCHEMA` = DATABASE()
) <> 9;

-- These result sets are reachable only after every fail-fast assertion passed.
INSERT INTO `_fixture_verification_summary`
SELECT 'expected_fixture_rows', COUNT(*) FROM `_fixture_expected_record`;

INSERT INTO `_fixture_verification_summary`
SELECT 'actual_fixture_rows', COUNT(*) FROM `_fixture_actual_record`;

INSERT INTO `_fixture_verification_summary`
SELECT 'flyway_version', MAX(CAST(`version` AS UNSIGNED))
FROM `flyway_schema_history`
WHERE `success` = 1;

INSERT INTO `_fixture_verification_summary`
SELECT 'trigger_count', COUNT(*)
FROM `information_schema`.`TRIGGERS`
WHERE `TRIGGER_SCHEMA` = DATABASE();

SELECT
	'PASS' AS `verification_status`,
	17 AS `assertion_groups`,
	MAX(CASE WHEN `metric_name` = 'expected_fixture_rows' THEN `metric_value` END) AS `expected_fixture_rows`,
	MAX(CASE WHEN `metric_name` = 'actual_fixture_rows' THEN `metric_value` END) AS `actual_fixture_rows`,
	MAX(CASE WHEN `metric_name` = 'flyway_version' THEN `metric_value` END) AS `flyway_version`,
	MAX(CASE WHEN `metric_name` = 'trigger_count' THEN `metric_value` END) AS `trigger_count`
FROM `_fixture_verification_summary`;

SELECT
	`expected`.`entity_name`,
	COUNT(*) AS `expected_count`,
	(
		SELECT COUNT(*)
		FROM `_fixture_actual_record` AS `actual`
		WHERE `actual`.`entity_name` = `expected`.`entity_name`
	) AS `actual_count`
FROM `_fixture_expected_record` AS `expected`
GROUP BY `expected`.`entity_name`
ORDER BY `expected`.`entity_name`;

SELECT
	`expected`.`scenario_key`,
	`expected`.`user_id`,
	`expected`.`user_ref`,
	`expected`.`name`,
	`expected`.`face_registered` AS `expected_face_registered`,
	`expected`.`has_in_progress_rental` AS `expected_has_in_progress_rental`,
	`expected`.`has_recovery_required` AS `expected_has_recovery_required`,
	`expected`.`has_unpaid_settlement` AS `expected_has_unpaid_settlement`,
	`expected`.`authority_eligible` AS `expected_authority_eligible`,
	`expected`.`rental_eligible` AS `expected_rental_eligible`,
	`expected`.`is_evaluated` AS `expected_is_evaluated`,
	`actual`.`face_registered` AS `actual_face_registered`,
	`actual`.`has_in_progress_rental` AS `actual_has_in_progress_rental`,
	`actual`.`has_recovery_required` AS `actual_has_recovery_required`,
	`actual`.`has_unpaid_settlement` AS `actual_has_unpaid_settlement`,
	`actual`.`authority_eligible` AS `actual_authority_eligible`,
	`actual`.`rental_eligible` AS `actual_rental_eligible`,
	`actual`.`rental_eligibility_evaluated_at`
FROM `_fixture_expected_user_state` AS `expected`
INNER JOIN `_fixture_user_authority` AS `actual`
	ON `actual`.`user_id` = `expected`.`user_id`
ORDER BY `expected`.`user_id`;

COMMIT;

DROP TEMPORARY TABLE `_fixture_verify_guard`;
DROP TEMPORARY TABLE `_fixture_verification_summary`;
DROP TEMPORARY TABLE `_fixture_user_authority`;
DROP TEMPORARY TABLE `_fixture_actual_request_key`;
DROP TEMPORARY TABLE `_fixture_actual_record`;
DROP TEMPORARY TABLE `_fixture_expected_trigger`;
DROP TEMPORARY TABLE `_fixture_expected_face_sync_state`;
DROP TEMPORARY TABLE `_fixture_expected_payment_state`;
DROP TEMPORARY TABLE `_fixture_expected_settlement_state`;
DROP TEMPORARY TABLE `_fixture_expected_ai_state`;
DROP TEMPORARY TABLE `_fixture_expected_return_state`;
DROP TEMPORARY TABLE `_fixture_expected_rental_state`;
DROP TEMPORARY TABLE `_fixture_expected_user_state`;
DROP TEMPORARY TABLE `_fixture_expected_request_key`;
DROP TEMPORARY TABLE `_fixture_expected_record`;
