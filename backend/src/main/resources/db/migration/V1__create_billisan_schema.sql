CREATE TABLE `station` (
	`station_id`	CHAR(36)	NOT NULL,
	`name`	VARCHAR(100)	NOT NULL,
	`service_status`	VARCHAR(30)	NOT NULL,
	`device_status`	VARCHAR(30)	NOT NULL,
	`current_boot_id`	VARCHAR(100)	NULL,
	`boot_synced_at`	DATETIME(6)	NULL,
	`last_seen_at`	DATETIME(6)	NULL,
	`created_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE TABLE `rental` (
	`rental_id`	CHAR(36)	NOT NULL,
	`user_id`	CHAR(36)	NOT NULL,
	`checkout_slot_id`	CHAR(36)	NOT NULL,
	`rental_request_id`	VARCHAR(100)	NOT NULL,
	`status`	VARCHAR(30)	NOT NULL,
	`requested_at`	DATETIME(6)	NOT NULL,
	`rented_at`	DATETIME(6)	NULL,
	`due_at`	DATETIME(6)	NULL,
	`ended_at`	DATETIME(6)	NULL,
	`created_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE TABLE `damage_inspection` (
	`inspection_id`	CHAR(36)	NOT NULL,
	`return_attempt_id`	CHAR(36)	NOT NULL,
	`request_id`	VARCHAR(100)	NOT NULL,
	`status`	VARCHAR(30)	NOT NULL,
	`ai_result`	VARCHAR(50)	NULL,
	`confidence`	DECIMAL(5,4)	NULL,
	`model_version`	VARCHAR(100)	NULL,
	`admin_decision`	VARCHAR(50)	NULL,
	`reviewed_by`	CHAR(36)	NULL,
	`reviewed_at`	DATETIME(6)	NULL,
	`created_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE TABLE `slot` (
	`slot_id`	CHAR(36)	NOT NULL,
	`station_id`	CHAR(36)	NOT NULL,
	`slot_number`	INT	NOT NULL,
	`service_status`	VARCHAR(30)	NOT NULL,
	`occupancy_status`	VARCHAR(30)	NOT NULL,
	`lock_status`	VARCHAR(30)	NOT NULL,
	`item_condition`	VARCHAR(30)	NULL,
	`created_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE TABLE `payment_attempt` (
	`payment_attempt_id`	CHAR(36)	NOT NULL,
	`settlement_id`	CHAR(36)	NOT NULL,
	`creation_request_id`	VARCHAR(100)	NOT NULL,
	`toss_order_id`	VARCHAR(100)	NULL,
	`toss_payment_key`	VARCHAR(200)	NULL,
	`amount`	BIGINT	NOT NULL,
	`provider`	VARCHAR(30)	NOT NULL,
	`toss_status`	VARCHAR(50)	NULL,
	`failure_code`	VARCHAR(100)	NULL,
	`failure_message`	VARCHAR(500)	NULL,
	`status`	VARCHAR(30)	NOT NULL,
	`requested_at`	DATETIME(6)	NOT NULL,
	`approved_at`	DATETIME(6)	NULL,
	`completed_at`	DATETIME(6)	NULL,
	`created_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE TABLE `return_attempt` (
	`return_attempt_id`	CHAR(36)	NOT NULL,
	`rental_id`	CHAR(36)	NOT NULL,
	`target_slot_id`	CHAR(36)	NOT NULL,
	`request_id`	VARCHAR(100)	NOT NULL,
	`status`	VARCHAR(30)	NOT NULL,
	`physical_completed_at`	DATETIME(6)	NULL,
	`completed_at`	DATETIME(6)	NULL,
	`failure_reason`	VARCHAR(255)	NULL,
	`created_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6)
);

-- P0-3 Option A:
-- DEVICE_OPERATION is an independent device Command/Terminal ledger.
-- It intentionally has no rental_id, return_attempt_id, business_id,
-- or correlation_id relationship to rental and return domain records.
CREATE TABLE `device_operation` (
	`operation_id`	CHAR(36)	NOT NULL,
	`station_id`	CHAR(36)	NOT NULL,
	`slot_id`	CHAR(36)	NULL,
	`command_id`	VARCHAR(100)	NOT NULL,
	`event_id`	VARCHAR(100)	NULL,
	`issued_boot_id`	VARCHAR(100)	NULL,
	`operation_type`	VARCHAR(50)	NOT NULL,
	`status`	VARCHAR(30)	NOT NULL,
	`terminal_event_type`	VARCHAR(50)	NULL,
	`result_code`	VARCHAR(100)	NULL,
	`observed_occupancy_status`	VARCHAR(30)	NULL,
	`observed_lock_status`	VARCHAR(30)	NULL,
	`evidence_schema_version`	SMALLINT	NULL,
	`evidence_observed_at`	DATETIME(6)	NULL,
	`evidence_payload`	JSON	NULL,
	`requested_at`	DATETIME(6)	NOT NULL,
	`acked_at`	DATETIME(6)	NULL,
	`completed_at`	DATETIME(6)	NULL,
	`created_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6)
) COMMENT = 'Independent device Command/Terminal ledger; no rental or return business relationship';

CREATE TABLE `settlement` (
	`settlement_id`	CHAR(36)	NOT NULL,
	`user_id`	CHAR(36)	NOT NULL,
	`rental_id`	CHAR(36)	NOT NULL,
	`reason`	VARCHAR(50)	NOT NULL,
	`amount`	BIGINT	NOT NULL,
	`paid_amount`	BIGINT	NOT NULL	DEFAULT 0,
	`status`	VARCHAR(30)	NOT NULL,
	`created_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6),
	`paid_at`	DATETIME(6)	NULL,
	`updated_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE TABLE `face_profile_sync_operation` (
	`id`	BIGINT	NOT NULL,
	`request_id`	VARCHAR(100)	NOT NULL,
	`user_id`	CHAR(36)	NOT NULL,
	`operation_type`	VARCHAR(30)	NOT NULL,
	`template_version`	INT	NOT NULL,
	`sync_status`	VARCHAR(30)	NOT NULL,
	`last_error_code`	VARCHAR(100)	NULL,
	`requested_at`	DATETIME(6)	NOT NULL,
	`completed_at`	DATETIME(6)	NULL,
	`created_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE TABLE `user_account` (
	`user_id`	CHAR(36)	NOT NULL,
	`login_id`	VARCHAR(100)	NOT NULL,
	`password_hash`	VARCHAR(255)	NOT NULL,
	`name`	VARCHAR(100)	NOT NULL,
	`face_registered`	BOOLEAN	NOT NULL	DEFAULT FALSE,
	`created_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE TABLE `admin_account` (
	`admin_id`	CHAR(36)	NOT NULL,
	`login_id`	VARCHAR(100)	NOT NULL,
	`password_hash`	VARCHAR(255)	NOT NULL,
	`name`	VARCHAR(100)	NOT NULL,
	`created_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at`	DATETIME(6)	NOT NULL	DEFAULT CURRENT_TIMESTAMP(6)
);

ALTER TABLE `station` ADD CONSTRAINT `PK_STATION` PRIMARY KEY (
	`station_id`
);

ALTER TABLE `rental` ADD CONSTRAINT `PK_RENTAL` PRIMARY KEY (
	`rental_id`
);

ALTER TABLE `damage_inspection` ADD CONSTRAINT `PK_DAMAGE_INSPECTION` PRIMARY KEY (
	`inspection_id`
);

ALTER TABLE `slot` ADD CONSTRAINT `PK_SLOT` PRIMARY KEY (
	`slot_id`
);

ALTER TABLE `payment_attempt` ADD CONSTRAINT `PK_PAYMENT_ATTEMPT` PRIMARY KEY (
	`payment_attempt_id`
);

ALTER TABLE `return_attempt` ADD CONSTRAINT `PK_RETURN_ATTEMPT` PRIMARY KEY (
	`return_attempt_id`
);

ALTER TABLE `device_operation` ADD CONSTRAINT `PK_DEVICE_OPERATION` PRIMARY KEY (
	`operation_id`
);

ALTER TABLE `settlement` ADD CONSTRAINT `PK_SETTLEMENT` PRIMARY KEY (
	`settlement_id`
);

ALTER TABLE `face_profile_sync_operation` ADD CONSTRAINT `PK_FACE_PROFILE_SYNC_OPERATION` PRIMARY KEY (
	`id`
);

ALTER TABLE `user_account` ADD CONSTRAINT `PK_USER_ACCOUNT` PRIMARY KEY (
	`user_id`
);

ALTER TABLE `admin_account` ADD CONSTRAINT `PK_ADMIN_ACCOUNT` PRIMARY KEY (
	`admin_id`
);

ALTER TABLE `admin_account` ADD CONSTRAINT `UK_ADMIN_ACCOUNT_LOGIN_ID` UNIQUE (
	`login_id`
);

ALTER TABLE `damage_inspection` ADD INDEX `IDX_DAMAGE_INSPECTION_REVIEWED_BY` (
	`reviewed_by`
);

ALTER TABLE `damage_inspection` ADD CONSTRAINT `FK_DAMAGE_INSPECTION_REVIEWED_BY`
FOREIGN KEY (
	`reviewed_by`
) REFERENCES `admin_account` (
	`admin_id`
) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE `damage_inspection` ADD CONSTRAINT `CK_DAMAGE_INSPECTION_ADMIN_REVIEW_AUDIT`
CHECK (
	(
		`admin_decision` IS NULL
		AND `reviewed_by` IS NULL
		AND `reviewed_at` IS NULL
	)
	OR
	(
		`admin_decision` IS NOT NULL
		AND `reviewed_by` IS NOT NULL
		AND `reviewed_at` IS NOT NULL
	)
);
