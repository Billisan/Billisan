-- Billisan P0-P1 final clean-install schema
-- Target: MySQL 8.0.16+ (CHECK constraints must be enforced)
-- Baseline: Flyway V1 through V18
-- Generated for Backend 3 handoff on 2026-07-29
--
-- IMPORTANT
-- 1. This file is for a new, empty schema only.
-- 2. Do not run it against a database already managed by Flyway.
-- 3. Existing databases must use p0_4_flyway/migrations/V1__... through V18__....
-- 4. Every application and database session must use UTC.
-- 5. PostgreSQL FACE_PROFILE is a separate Orin-owned SSOT and is not created here.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE `station` (
	`station_id` CHAR(36) NOT NULL,
	`name` VARCHAR(100) NOT NULL,
	`service_status` VARCHAR(30) NOT NULL,
	`device_status` VARCHAR(30) NOT NULL,
	`current_boot_id` VARCHAR(100) NULL,
	`boot_synced_at` DATETIME(6) NULL,
	`last_seen_at` DATETIME(6) NULL,
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
		ON UPDATE CURRENT_TIMESTAMP(6),
	CONSTRAINT `PK_STATION` PRIMARY KEY (`station_id`),
	CONSTRAINT `CK_STATION_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	CONSTRAINT `CK_STATION_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`service_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			AND REGEXP_LIKE(`device_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
		)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_account` (
	`user_id` CHAR(9)
		CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Exact nine-digit student number; Spring/MySQL business boundary only',
	`user_ref` CHAR(36)
		CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque UUID for face and device boundary; never derived from student number or login ID',
	`login_id` VARCHAR(254) NOT NULL
		COMMENT 'Normalized university email; never the student number',
	`password_hash` VARCHAR(255) NOT NULL,
	`name` VARCHAR(100) NOT NULL,
	`face_registered` BOOLEAN NOT NULL DEFAULT FALSE,
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
		ON UPDATE CURRENT_TIMESTAMP(6),
	CONSTRAINT `PK_USER_ACCOUNT` PRIMARY KEY (`user_id`),
	CONSTRAINT `UK_USER_ACCOUNT_USER_REF` UNIQUE (`user_ref`),
	CONSTRAINT `UK_USER_ACCOUNT_LOGIN_ID` UNIQUE (`login_id`),
	CONSTRAINT `CK_USER_ACCOUNT_STUDENT_NUMBER`
		CHECK (
			REGEXP_LIKE(`user_id`, _ascii'^[0-9]{9}$', 'c')
		),
	CONSTRAINT `CK_USER_ACCOUNT_LOGIN_ID_EMAIL`
		CHECK (
			CHAR_LENGTH(`login_id`) BETWEEN 3 AND 254
			AND CAST(`login_id` AS BINARY)
				= CAST(LOWER(TRIM(`login_id`)) AS BINARY)
			AND REGEXP_LIKE(
				`login_id`,
				'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$',
				'c'
			)
		),
	CONSTRAINT `CK_USER_ACCOUNT_USER_REF_UUID`
		CHECK (
			REGEXP_LIKE(
				`user_ref`,
				_ascii'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
				'c'
			)
		),
	CONSTRAINT `CK_USER_ACCOUNT_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `admin_account` (
	`admin_id` CHAR(36) NOT NULL,
	`login_id` VARCHAR(100) NOT NULL,
	`password_hash` VARCHAR(255) NOT NULL,
	`name` VARCHAR(100) NOT NULL,
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
		ON UPDATE CURRENT_TIMESTAMP(6),
	CONSTRAINT `PK_ADMIN_ACCOUNT` PRIMARY KEY (`admin_id`),
	CONSTRAINT `UK_ADMIN_ACCOUNT_LOGIN_ID` UNIQUE (`login_id`),
	CONSTRAINT `CK_ADMIN_ACCOUNT_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `slot` (
	`slot_id` CHAR(36) NOT NULL,
	`station_id` CHAR(36) NOT NULL,
	`slot_number` INT NOT NULL,
	`service_status` VARCHAR(30) NOT NULL,
	`occupancy_status` VARCHAR(30) NOT NULL,
	`lock_status` VARCHAR(30) NOT NULL,
	`item_condition` VARCHAR(50) NULL,
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
		ON UPDATE CURRENT_TIMESTAMP(6),
	CONSTRAINT `PK_SLOT` PRIMARY KEY (`slot_id`),
	CONSTRAINT `UK_SLOT_STATION_NUMBER` UNIQUE (`station_id`, `slot_number`),
	CONSTRAINT `UK_SLOT_ID_STATION_ID` UNIQUE (`slot_id`, `station_id`),
	CONSTRAINT `CK_SLOT_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	CONSTRAINT `CK_SLOT_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`service_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			AND REGEXP_LIKE(`occupancy_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			AND REGEXP_LIKE(`lock_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			AND (
				`item_condition` IS NULL
				OR REGEXP_LIKE(`item_condition`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			)
		),
	CONSTRAINT `FK_SLOT_STATION`
		FOREIGN KEY (`station_id`) REFERENCES `station` (`station_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `rental` (
	`rental_id` CHAR(36) NOT NULL,
	`user_id` CHAR(9)
		CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`checkout_slot_id` CHAR(36) NOT NULL,
	`rental_request_id` VARCHAR(100)
		CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque case-sensitive idempotency key',
	`status` VARCHAR(30) NOT NULL,
	`failure_code` VARCHAR(100) NULL
		COMMENT 'Stable business failure code; never a raw exception type',
	`failure_message` VARCHAR(500) NULL
		COMMENT 'Optional sanitized summary; no PII, stack trace, raw exception, or full MQTT payload',
	`failed_at` DATETIME(6) NULL,
	`requested_at` DATETIME(6) NOT NULL,
	`rented_at` DATETIME(6) NULL,
	`due_at` DATETIME(6) NULL,
	`ended_at` DATETIME(6) NULL,
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
		ON UPDATE CURRENT_TIMESTAMP(6),
	`active_user_guard` CHAR(9)
		CHARACTER SET ascii COLLATE ascii_bin
		GENERATED ALWAYS AS (
			CASE
				WHEN `status` IN ('REQUESTED', 'ACTIVE', 'RETURNING')
					THEN `user_id`
				ELSE NULL
			END
		) STORED,
	`requested_slot_guard` CHAR(36)
		GENERATED ALWAYS AS (
			CASE
				WHEN `status` = 'REQUESTED' THEN `checkout_slot_id`
				ELSE NULL
			END
		) STORED,
	CONSTRAINT `PK_RENTAL` PRIMARY KEY (`rental_id`),
	CONSTRAINT `UK_RENTAL_ID_USER_ID` UNIQUE (`rental_id`, `user_id`),
	CONSTRAINT `UK_RENTAL_REQUEST_ID` UNIQUE (`rental_request_id`),
	CONSTRAINT `UK_RENTAL_ACTIVE_USER_GUARD` UNIQUE (`active_user_guard`),
	CONSTRAINT `UK_RENTAL_REQUESTED_SLOT_GUARD`
		UNIQUE (`requested_slot_guard`),
	CONSTRAINT `CK_RENTAL_STATUS`
		CHECK (
			`status` IN (
				'REQUESTED',
				'ACTIVE',
				'RETURNING',
				'COMPLETED',
				'LOST',
				'CANCELLED',
				'FAILED'
			)
		),
	CONSTRAINT `CK_RENTAL_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	CONSTRAINT `CK_RENTAL_LIFECYCLE_TIME_ORDER`
		CHECK (
			(`rented_at` IS NULL OR `rented_at` >= `requested_at`)
			AND (
				`due_at` IS NULL
				OR (
					`rented_at` IS NOT NULL
					AND `due_at` = DATE_ADD(`rented_at`, INTERVAL 24 HOUR)
				)
			)
			AND (
				`ended_at` IS NULL
				OR (
					`rented_at` IS NOT NULL
					AND `ended_at` >= `rented_at`
				)
			)
		),
	CONSTRAINT `CK_RENTAL_STATE_TIME_COMPLETENESS`
		CHECK (
			(
				`status` = 'REQUESTED'
				AND `rented_at` IS NULL
				AND `due_at` IS NULL
				AND `ended_at` IS NULL
			)
			OR (
				`status` IN ('ACTIVE', 'RETURNING')
				AND `rented_at` IS NOT NULL
				AND `due_at` IS NOT NULL
				AND `ended_at` IS NULL
			)
			OR (
				`status` IN ('COMPLETED', 'LOST')
				AND `rented_at` IS NOT NULL
				AND `due_at` IS NOT NULL
				AND `ended_at` IS NOT NULL
			)
			OR `status` IN ('CANCELLED', 'FAILED')
		),
	CONSTRAINT `CK_RENTAL_FAILURE_CODE`
		CHECK (
			`failure_code` IS NULL
			OR BINARY `failure_code` IN (
				'AUTHENTICATION_FAILED',
				'USER_NOT_ELIGIBLE',
				'SLOT_NOT_AVAILABLE',
				'SLOT_CONFLICT',
				'MQTT_BROKER_UNAVAILABLE',
				'DEVICE_OFFLINE',
				'DEVICE_COMMAND_TIMEOUT',
				'UNLOCK_FAILED',
				'PHYSICAL_REMOVAL_NOT_DETECTED',
				'STATE_RECONCILIATION_REQUIRED',
				'INTERNAL_ERROR',
				'LEGACY_UNSPECIFIED'
			)
		),
	CONSTRAINT `CK_RENTAL_FAILURE_STATE`
		CHECK (
			(
				`status` = 'FAILED'
				AND `failure_code` IS NOT NULL
				AND `failed_at` IS NOT NULL
			)
			OR (
				`status` <> 'FAILED'
				AND `failure_code` IS NULL
				AND `failure_message` IS NULL
				AND `failed_at` IS NULL
			)
		),
	CONSTRAINT `CK_RENTAL_FAILURE_TIME_ORDER`
		CHECK (`failed_at` IS NULL OR `failed_at` >= `requested_at`),
	CONSTRAINT `CK_RENTAL_IDEMPOTENCY_KEY_SHAPE`
		CHECK (
			CHAR_LENGTH(TRIM(`rental_request_id`)) BETWEEN 1 AND 100
			AND OCTET_LENGTH(`rental_request_id`)
				= OCTET_LENGTH(TRIM(`rental_request_id`))
		),
	CONSTRAINT `CK_RENTAL_ENUM_STORAGE`
		CHECK (REGEXP_LIKE(`status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')),
	CONSTRAINT `FK_RENTAL_USER`
		FOREIGN KEY (`user_id`) REFERENCES `user_account` (`user_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `FK_RENTAL_CHECKOUT_SLOT`
		FOREIGN KEY (`checkout_slot_id`) REFERENCES `slot` (`slot_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `return_attempt` (
	`return_attempt_id` CHAR(36) NOT NULL,
	`rental_id` CHAR(36) NOT NULL,
	`return_slot_id` CHAR(36) NULL
		COMMENT 'Spring-selected authoritative physical return slot after inspection',
	`request_id` VARCHAR(100)
		CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque case-sensitive idempotency key',
	`status` VARCHAR(30) NOT NULL,
	`physical_completed_at` DATETIME(6) NULL,
	`completed_at` DATETIME(6) NULL,
	`failure_reason` VARCHAR(255) NULL,
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
		ON UPDATE CURRENT_TIMESTAMP(6),
	`claimed_rental_guard` CHAR(36)
		GENERATED ALWAYS AS (
			CASE
				WHEN `status` IN (
					'PROCESSING',
					'PHYSICAL_DONE',
					'RECOVERY_REQUIRED',
					'COMPLETED'
				)
					THEN `rental_id`
				ELSE NULL
			END
		) STORED,
	`assigned_return_slot_guard` CHAR(36)
		GENERATED ALWAYS AS (
			CASE
				WHEN `return_slot_id` IS NOT NULL
					AND `status` IN (
						'PROCESSING',
						'PHYSICAL_DONE',
						'RECOVERY_REQUIRED'
					)
					THEN `return_slot_id`
				ELSE NULL
			END
		) STORED,
	CONSTRAINT `PK_RETURN_ATTEMPT` PRIMARY KEY (`return_attempt_id`),
	CONSTRAINT `UK_RETURN_ATTEMPT_REQUEST_ID` UNIQUE (`request_id`),
	CONSTRAINT `UK_RETURN_ATTEMPT_CLAIMED_RENTAL_GUARD`
		UNIQUE (`claimed_rental_guard`),
	CONSTRAINT `UK_RETURN_ATTEMPT_ID_RENTAL_ID`
		UNIQUE (`return_attempt_id`, `rental_id`),
	CONSTRAINT `UK_RETURN_ATTEMPT_ASSIGNED_SLOT_GUARD`
		UNIQUE (`assigned_return_slot_guard`),
	CONSTRAINT `CK_RETURN_ATTEMPT_STATUS`
		CHECK (
			`status` IN (
				'PROCESSING',
				'PHYSICAL_DONE',
				'COMPLETED',
				'RECOVERY_REQUIRED',
				'FAILED'
			)
		),
	CONSTRAINT `CK_RETURN_ATTEMPT_REQUIRED_RETURN_SLOT`
		CHECK (
			`status` NOT IN ('PHYSICAL_DONE', 'COMPLETED')
			OR `return_slot_id` IS NOT NULL
		),
	CONSTRAINT `CK_RETURN_ATTEMPT_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	CONSTRAINT `CK_RETURN_ATTEMPT_LIFECYCLE_TIME_ORDER`
		CHECK (
			(
				`physical_completed_at` IS NULL
				OR `physical_completed_at` >= `created_at`
			)
			AND (
				`completed_at` IS NULL
				OR (
					`physical_completed_at` IS NOT NULL
					AND `completed_at` >= `physical_completed_at`
				)
			)
		),
	CONSTRAINT `CK_RETURN_ATTEMPT_STATE_TIME_COMPLETENESS`
		CHECK (
			(
				`status` = 'PROCESSING'
				AND `physical_completed_at` IS NULL
				AND `completed_at` IS NULL
			)
			OR (
				`status` = 'PHYSICAL_DONE'
				AND `physical_completed_at` IS NOT NULL
				AND `completed_at` IS NULL
			)
			OR (
				`status` = 'COMPLETED'
				AND `physical_completed_at` IS NOT NULL
				AND `completed_at` IS NOT NULL
			)
			OR (
				`status` IN ('RECOVERY_REQUIRED', 'FAILED')
				AND `completed_at` IS NULL
			)
		),
	CONSTRAINT `CK_RETURN_ATTEMPT_IDEMPOTENCY_KEY_SHAPE`
		CHECK (
			CHAR_LENGTH(TRIM(`request_id`)) BETWEEN 1 AND 100
			AND OCTET_LENGTH(`request_id`) = OCTET_LENGTH(TRIM(`request_id`))
		),
	CONSTRAINT `CK_RETURN_ATTEMPT_ENUM_STORAGE`
		CHECK (REGEXP_LIKE(`status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')),
	CONSTRAINT `FK_RETURN_ATTEMPT_RENTAL`
		FOREIGN KEY (`rental_id`) REFERENCES `rental` (`rental_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `FK_RETURN_ATTEMPT_RETURN_SLOT`
		FOREIGN KEY (`return_slot_id`) REFERENCES `slot` (`slot_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `damage_inspection` (
	`inspection_id` CHAR(36) NOT NULL,
	`return_attempt_id` CHAR(36) NOT NULL,
	`rental_id` CHAR(36) NOT NULL,
	`request_id` VARCHAR(100)
		CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque case-sensitive idempotency key',
	`requested_at` DATETIME(6) NOT NULL
		COMMENT 'UTC time when Spring durably accepted the AI inspection request',
	`status` VARCHAR(30) NOT NULL,
	`ai_result` VARCHAR(50) NULL,
	`confidence` DECIMAL(5,4) NULL,
	`model_version` VARCHAR(100) NULL,
	`completed_at` DATETIME(6) NULL
		COMMENT 'UTC time when Spring durably stored the terminal AI result',
	`admin_decision` VARCHAR(50) NULL,
	`reviewed_by` CHAR(36) NULL,
	`reviewed_at` DATETIME(6) NULL,
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
		ON UPDATE CURRENT_TIMESTAMP(6),
	`settlement_eligible_guard` TINYINT
		GENERATED ALWAYS AS (
			CASE
				WHEN `status` = 'COMPLETED'
					AND `admin_decision` = 'DAMAGED'
					AND `reviewed_by` IS NOT NULL
					AND `reviewed_at` IS NOT NULL
					THEN 1
				ELSE NULL
			END
		) STORED,
	CONSTRAINT `PK_DAMAGE_INSPECTION` PRIMARY KEY (`inspection_id`),
	CONSTRAINT `UK_DAMAGE_INSPECTION_REQUEST_ID` UNIQUE (`request_id`),
	CONSTRAINT `UK_DAMAGE_INSPECTION_RETURN_ATTEMPT_ID`
		UNIQUE (`return_attempt_id`),
	CONSTRAINT `UK_DAMAGE_INSPECTION_RENTAL_ELIGIBLE`
		UNIQUE (
			`inspection_id`,
			`rental_id`,
			`settlement_eligible_guard`
		),
	INDEX `IDX_DAMAGE_INSPECTION_REVIEWED_BY` (`reviewed_by`),
	CONSTRAINT `CK_DAMAGE_INSPECTION_STATUS`
		CHECK (`status` IN ('REQUESTED', 'COMPLETED', 'FAILED')),
	CONSTRAINT `CK_DAMAGE_INSPECTION_ADMIN_REVIEW_AUDIT`
		CHECK (
			(
				`admin_decision` IS NULL
				AND `reviewed_by` IS NULL
				AND `reviewed_at` IS NULL
			)
			OR (
				`admin_decision` IS NOT NULL
				AND `reviewed_by` IS NOT NULL
				AND `reviewed_at` IS NOT NULL
			)
		),
	CONSTRAINT `CK_DAMAGE_INSPECTION_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	CONSTRAINT `CK_DAMAGE_INSPECTION_REVIEW_TIME_ORDER`
		CHECK (`reviewed_at` IS NULL OR `reviewed_at` >= `created_at`),
	CONSTRAINT `CK_DAMAGE_INSPECTION_PROCESSING_STATE_TIME`
		CHECK (
			(
				`status` = 'REQUESTED'
				AND `completed_at` IS NULL
			)
			OR (
				`status` IN ('COMPLETED', 'FAILED')
				AND `completed_at` IS NOT NULL
			)
		),
	CONSTRAINT `CK_DAMAGE_INSPECTION_PROCESSING_TIME_ORDER`
		CHECK (`completed_at` IS NULL OR `completed_at` >= `requested_at`),
	CONSTRAINT `CK_DAMAGE_INSPECTION_REVIEW_AFTER_PROCESSING`
		CHECK (
			`reviewed_at` IS NULL
			OR (
				`completed_at` IS NOT NULL
				AND `reviewed_at` >= `completed_at`
			)
		),
	CONSTRAINT `CK_DAMAGE_INSPECTION_IDEMPOTENCY_KEY_SHAPE`
		CHECK (
			CHAR_LENGTH(TRIM(`request_id`)) BETWEEN 1 AND 100
			AND OCTET_LENGTH(`request_id`) = OCTET_LENGTH(TRIM(`request_id`))
		),
	CONSTRAINT `CK_DAMAGE_INSPECTION_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			AND (
				`ai_result` IS NULL
				OR REGEXP_LIKE(`ai_result`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			)
			AND (
				`admin_decision` IS NULL
				OR REGEXP_LIKE(`admin_decision`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			)
		),
	CONSTRAINT `CK_DAMAGE_INSPECTION_AI_RESULT`
		CHECK (
			`ai_result` IS NULL
			OR `ai_result` IN ('NORMAL', 'DAMAGED', 'UNCERTAIN')
		),
	CONSTRAINT `CK_DAMAGE_INSPECTION_CONFIDENCE`
		CHECK (
			`confidence` IS NULL
			OR (`confidence` >= 0.0000 AND `confidence` <= 1.0000)
		),
	CONSTRAINT `CK_DAMAGE_INSPECTION_AI_OUTPUT_STATE`
		CHECK (
			(
				`status` = 'REQUESTED'
				AND `ai_result` IS NULL
				AND `confidence` IS NULL
				AND `model_version` IS NULL
			)
			OR (
				`status` = 'COMPLETED'
				AND `ai_result` IS NOT NULL
				AND `ai_result` IN ('NORMAL', 'DAMAGED', 'UNCERTAIN')
				AND `confidence` IS NOT NULL
				AND `model_version` IS NOT NULL
				AND CHAR_LENGTH(TRIM(`model_version`)) BETWEEN 1 AND 100
			)
			OR (
				`status` = 'FAILED'
				AND `ai_result` IS NULL
				AND `confidence` IS NULL
				AND (
					`model_version` IS NULL
					OR CHAR_LENGTH(TRIM(`model_version`)) BETWEEN 1 AND 100
				)
			)
		),
	CONSTRAINT `CK_DAMAGE_INSPECTION_REVIEW_COMPLETED_ONLY`
		CHECK (`admin_decision` IS NULL OR `status` = 'COMPLETED'),
	CONSTRAINT `FK_DAMAGE_INSPECTION_RETURN_ATTEMPT_RENTAL`
		FOREIGN KEY (`return_attempt_id`, `rental_id`)
		REFERENCES `return_attempt` (`return_attempt_id`, `rental_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `FK_DAMAGE_INSPECTION_REVIEWED_BY`
		FOREIGN KEY (`reviewed_by`) REFERENCES `admin_account` (`admin_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `face_profile_sync_operation` (
	`sync_operation_id` CHAR(36)
		CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`request_id` VARCHAR(100)
		CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque case-sensitive idempotency key',
	`user_ref` CHAR(36)
		CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque USER_ACCOUNT.user_ref; never a student number',
	`operation_type` VARCHAR(50) NOT NULL,
	`template_version` INT NOT NULL,
	`sync_status` VARCHAR(30) NOT NULL,
	`last_error_code` VARCHAR(100) NULL,
	`requested_at` DATETIME(6) NOT NULL,
	`completed_at` DATETIME(6) NULL,
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
		ON UPDATE CURRENT_TIMESTAMP(6),
	CONSTRAINT `PK_FACE_PROFILE_SYNC_OPERATION`
		PRIMARY KEY (`sync_operation_id`),
	CONSTRAINT `UK_FACE_PROFILE_SYNC_REQUEST_ID` UNIQUE (`request_id`),
	CONSTRAINT `CK_FACE_PROFILE_SYNC_OPERATION_TYPE`
		CHECK (`operation_type` IN ('REGISTER', 'REREGISTER', 'DELETE')),
	CONSTRAINT `CK_FACE_PROFILE_SYNC_STATUS`
		CHECK (
			`sync_status` IN (
				'REQUESTED',
				'PROCESSING',
				'SUCCEEDED',
				'FAILED',
				'RECONCILIATION_REQUIRED'
			)
		),
	CONSTRAINT `CK_FACE_PROFILE_SYNC_OPERATION_UUID`
		CHECK (
			REGEXP_LIKE(
				`sync_operation_id`,
				_ascii'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
				'c'
			)
		),
	CONSTRAINT `CK_FACE_PROFILE_SYNC_USER_REF_UUID`
		CHECK (
			REGEXP_LIKE(
				`user_ref`,
				'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
				'c'
			)
		),
	CONSTRAINT `CK_FACE_PROFILE_SYNC_IDEMPOTENCY_KEY_SHAPE`
		CHECK (
			CHAR_LENGTH(TRIM(`request_id`)) BETWEEN 1 AND 100
			AND OCTET_LENGTH(`request_id`) = OCTET_LENGTH(TRIM(`request_id`))
		),
	CONSTRAINT `CK_FACE_PROFILE_SYNC_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`operation_type`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			AND REGEXP_LIKE(`sync_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
		),
	CONSTRAINT `CK_FACE_PROFILE_SYNC_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	CONSTRAINT `CK_FACE_PROFILE_SYNC_LIFECYCLE_TIME_ORDER`
		CHECK (`completed_at` IS NULL OR `completed_at` >= `requested_at`),
	CONSTRAINT `CK_FACE_PROFILE_SYNC_STATE_TIME_COMPLETENESS`
		CHECK (
			(
				`sync_status` IN ('SUCCEEDED', 'FAILED')
				AND `completed_at` IS NOT NULL
			)
			OR (
				`sync_status` IN (
					'REQUESTED',
					'PROCESSING',
					'RECONCILIATION_REQUIRED'
				)
				AND `completed_at` IS NULL
			)
		),
	CONSTRAINT `FK_FACE_PROFILE_SYNC_USER_REF`
		FOREIGN KEY (`user_ref`) REFERENCES `user_account` (`user_ref`)
		ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `settlement` (
	`settlement_id` CHAR(36) NOT NULL,
	`user_id` CHAR(9)
		CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`rental_id` CHAR(36) NOT NULL,
	`damage_inspection_id` CHAR(36) NULL
		COMMENT 'Administrator-reviewed DAMAGE_INSPECTION used as DAMAGE settlement basis',
	`reason` VARCHAR(50) NOT NULL,
	`amount` BIGINT UNSIGNED NOT NULL,
	`paid_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
	`status` VARCHAR(30) NOT NULL,
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`paid_at` DATETIME(6) NULL,
	`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
		ON UPDATE CURRENT_TIMESTAMP(6),
	`damage_basis_guard` TINYINT
		GENERATED ALWAYS AS (
			CASE
				WHEN `reason` = 'DAMAGE'
					AND `damage_inspection_id` IS NOT NULL
					THEN 1
				ELSE NULL
			END
		) STORED,
	CONSTRAINT `PK_SETTLEMENT` PRIMARY KEY (`settlement_id`),
	CONSTRAINT `UK_SETTLEMENT_RENTAL_ID` UNIQUE (`rental_id`),
	CONSTRAINT `UK_SETTLEMENT_DAMAGE_INSPECTION_ID`
		UNIQUE (`damage_inspection_id`),
	CONSTRAINT `CK_SETTLEMENT_REASON`
		CHECK (`reason` IN ('OVERDUE', 'LOSS', 'DAMAGE', 'ADJUSTMENT')),
	CONSTRAINT `CK_SETTLEMENT_STATUS`
		CHECK (`status` IN ('PENDING', 'PAID', 'CANCELLED')),
	CONSTRAINT `CK_SETTLEMENT_AMOUNT`
		CHECK (`amount` >= 0),
	CONSTRAINT `CK_SETTLEMENT_PAID_AMOUNT`
		CHECK (`paid_amount` >= 0 AND `paid_amount` <= `amount`),
	CONSTRAINT `CK_SETTLEMENT_DAMAGE_BASIS`
		CHECK (
			(
				`reason` = 'DAMAGE'
				AND `damage_inspection_id` IS NOT NULL
			)
			OR (
				`reason` <> 'DAMAGE'
				AND `damage_inspection_id` IS NULL
			)
		),
	CONSTRAINT `CK_SETTLEMENT_AMOUNT_CAP`
		CHECK (`amount` <= 7000),
	CONSTRAINT `CK_SETTLEMENT_PAYMENT_STATE`
		CHECK (
			(
				`status` = 'PAID'
				AND `paid_amount` = `amount`
				AND `paid_at` IS NOT NULL
			)
			OR (
				`status` = 'PENDING'
				AND `paid_amount` < `amount`
				AND `paid_at` IS NULL
			)
			OR (
				`status` = 'CANCELLED'
				AND `paid_amount` = 0
				AND `paid_at` IS NULL
			)
		),
	CONSTRAINT `CK_SETTLEMENT_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	CONSTRAINT `CK_SETTLEMENT_PAID_TIME_ORDER`
		CHECK (`paid_at` IS NULL OR `paid_at` >= `created_at`),
	CONSTRAINT `CK_SETTLEMENT_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`reason`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			AND REGEXP_LIKE(`status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
		),
	CONSTRAINT `CK_SETTLEMENT_REASON_AMOUNT`
		CHECK (
			(
				`reason` IN ('DAMAGE', 'LOSS')
				AND `amount` = 7000
			)
			OR (
				`reason` = 'OVERDUE'
				AND `amount` BETWEEN 1000 AND 6000
				AND MOD(`amount`, 1000) = 0
			)
			OR (
				`reason` = 'ADJUSTMENT'
				AND `amount` BETWEEN 0 AND 7000
			)
		),
	CONSTRAINT `FK_SETTLEMENT_RENTAL_USER`
		FOREIGN KEY (`rental_id`, `user_id`)
		REFERENCES `rental` (`rental_id`, `user_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `FK_SETTLEMENT_DAMAGE_INSPECTION`
		FOREIGN KEY (
			`damage_inspection_id`,
			`rental_id`,
			`damage_basis_guard`
		)
		REFERENCES `damage_inspection` (
			`inspection_id`,
			`rental_id`,
			`settlement_eligible_guard`
		)
		ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `payment_attempt` (
	`payment_attempt_id` CHAR(36) NOT NULL,
	`settlement_id` CHAR(36) NOT NULL,
	`creation_request_id` VARCHAR(100)
		CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque case-sensitive idempotency key',
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
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
		ON UPDATE CURRENT_TIMESTAMP(6),
	CONSTRAINT `PK_PAYMENT_ATTEMPT` PRIMARY KEY (`payment_attempt_id`),
	CONSTRAINT `UK_PAYMENT_CREATION_REQUEST_ID` UNIQUE (`creation_request_id`),
	CONSTRAINT `UK_PAYMENT_TOSS_ORDER_ID` UNIQUE (`toss_order_id`),
	CONSTRAINT `UK_PAYMENT_TOSS_PAYMENT_KEY` UNIQUE (`toss_payment_key`),
	CONSTRAINT `CK_PAYMENT_PROVIDER`
		CHECK (`provider` IN ('MOCK', 'TOSS_SANDBOX')),
	CONSTRAINT `CK_PAYMENT_STATUS`
		CHECK (
			`status` IN (
				'REQUESTED',
				'PROCESSING',
				'SUCCEEDED',
				'FAILED',
				'CANCELLED',
				'RECONCILIATION_REQUIRED'
			)
		),
	CONSTRAINT `CK_PAYMENT_AMOUNT`
		CHECK (`amount` >= 0),
	CONSTRAINT `CK_PAYMENT_ATTEMPT_AMOUNT_RANGE`
		CHECK (`amount` BETWEEN 1 AND 7000),
	CONSTRAINT `CK_PAYMENT_ATTEMPT_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	CONSTRAINT `CK_PAYMENT_ATTEMPT_LIFECYCLE_TIME_ORDER`
		CHECK (
			(`approved_at` IS NULL OR `approved_at` >= `requested_at`)
			AND (`completed_at` IS NULL OR `completed_at` >= `requested_at`)
			AND (
				`approved_at` IS NULL
				OR `completed_at` IS NULL
				OR `completed_at` >= `approved_at`
			)
		),
	CONSTRAINT `CK_PAYMENT_ATTEMPT_STATE_TIME_COMPLETENESS`
		CHECK (
			(
				`status` = 'REQUESTED'
				AND `approved_at` IS NULL
				AND `completed_at` IS NULL
			)
			OR (
				`status` = 'PROCESSING'
				AND `completed_at` IS NULL
			)
			OR (
				`status` = 'SUCCEEDED'
				AND `approved_at` IS NOT NULL
				AND `completed_at` IS NOT NULL
			)
			OR (
				`status` IN (
					'FAILED',
					'CANCELLED',
					'RECONCILIATION_REQUIRED'
				)
				AND `completed_at` IS NOT NULL
			)
		),
	CONSTRAINT `CK_PAYMENT_ATTEMPT_IDEMPOTENCY_KEY_SHAPE`
		CHECK (
			CHAR_LENGTH(TRIM(`creation_request_id`)) BETWEEN 1 AND 100
			AND OCTET_LENGTH(`creation_request_id`)
				= OCTET_LENGTH(TRIM(`creation_request_id`))
		),
	CONSTRAINT `CK_PAYMENT_ATTEMPT_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`provider`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			AND REGEXP_LIKE(`status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
		),
	CONSTRAINT `CK_PAYMENT_PROVIDER_STATUS_MAPPING`
		CHECK (
			(
				`provider` = 'MOCK'
				AND `toss_status` IS NULL
				AND `status` <> 'RECONCILIATION_REQUIRED'
			)
			OR (
				`provider` = 'TOSS_SANDBOX'
				AND (
					(
						`status` = 'REQUESTED'
						AND `toss_status` IS NULL
					)
					OR (
						`status` = 'PROCESSING'
						AND `toss_status` IS NOT NULL
						AND CAST(`toss_status` AS BINARY) IN (
							'READY',
							'IN_PROGRESS',
							'WAITING_FOR_DEPOSIT'
						)
					)
					OR (
						`status` = 'SUCCEEDED'
						AND `toss_status` IS NOT NULL
						AND CAST(`toss_status` AS BINARY) = 'DONE'
					)
					OR (
						`status` = 'FAILED'
						AND (
							`toss_status` IS NULL
							OR CAST(`toss_status` AS BINARY)
								IN ('ABORTED', 'EXPIRED')
						)
					)
					OR (
						`status` = 'CANCELLED'
						AND (
							`toss_status` IS NULL
							OR CAST(`toss_status` AS BINARY) = 'CANCELED'
						)
					)
					OR (
						`status` = 'RECONCILIATION_REQUIRED'
						AND `toss_status` IS NOT NULL
						AND CHAR_LENGTH(TRIM(`toss_status`)) BETWEEN 1 AND 50
						AND OCTET_LENGTH(`toss_status`)
							= OCTET_LENGTH(TRIM(`toss_status`))
					)
				)
			)
		),
	CONSTRAINT `FK_PAYMENT_ATTEMPT_SETTLEMENT`
		FOREIGN KEY (`settlement_id`) REFERENCES `settlement` (`settlement_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `device_operation` (
	`operation_id` CHAR(36) NOT NULL,
	`station_id` CHAR(36) NOT NULL,
	`slot_id` CHAR(36) NULL,
	`command_id` VARCHAR(100)
		CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque case-sensitive command deduplication key',
	`event_id` VARCHAR(100)
		CHARACTER SET ascii COLLATE ascii_bin NULL
		COMMENT 'Opaque case-sensitive terminal-event deduplication key',
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
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
		ON UPDATE CURRENT_TIMESTAMP(6),
	CONSTRAINT `PK_DEVICE_OPERATION` PRIMARY KEY (`operation_id`),
	CONSTRAINT `UK_DEVICE_OPERATION_COMMAND_ID` UNIQUE (`command_id`),
	CONSTRAINT `UK_DEVICE_OPERATION_EVENT_ID` UNIQUE (`event_id`),
	CONSTRAINT `CK_DEVICE_OPERATION_STATUS`
		CHECK (
			`status` IN (
				'REQUESTED',
				'ACKED',
				'SUCCEEDED',
				'FAILED',
				'TIMED_OUT',
				'OUTCOME_UNKNOWN'
			)
		),
	CONSTRAINT `CK_DEVICE_OPERATION_TERMINAL_EVENT_TYPE`
		CHECK (
			`terminal_event_type` IS NULL
			OR `terminal_event_type` IN (
				'OPERATION_COMPLETED',
				'OPERATION_FAILED'
			)
		),
	CONSTRAINT `CK_DEVICE_OPERATION_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	CONSTRAINT `CK_DEVICE_OPERATION_LIFECYCLE_TIME_ORDER`
		CHECK (
			(`acked_at` IS NULL OR `acked_at` >= `requested_at`)
			AND (
				`evidence_observed_at` IS NULL
				OR `evidence_observed_at` >= `requested_at`
			)
			AND (
				`completed_at` IS NULL
				OR `completed_at` >= COALESCE(`acked_at`, `requested_at`)
			)
		),
	CONSTRAINT `CK_DEVICE_OPERATION_STATE_TIME_COMPLETENESS`
		CHECK (
			(
				`status` = 'REQUESTED'
				AND `acked_at` IS NULL
				AND `completed_at` IS NULL
			)
			OR (
				`status` = 'ACKED'
				AND `acked_at` IS NOT NULL
				AND `completed_at` IS NULL
			)
			OR (
				`status` IN (
					'SUCCEEDED',
					'FAILED',
					'TIMED_OUT',
					'OUTCOME_UNKNOWN'
				)
				AND `completed_at` IS NOT NULL
			)
		),
	CONSTRAINT `CK_DEVICE_OPERATION_COMMAND_KEY_SHAPE`
		CHECK (
			CHAR_LENGTH(TRIM(`command_id`)) BETWEEN 1 AND 100
			AND OCTET_LENGTH(`command_id`) = OCTET_LENGTH(TRIM(`command_id`))
		),
	CONSTRAINT `CK_DEVICE_OPERATION_EVENT_KEY_SHAPE`
		CHECK (
			`event_id` IS NULL
			OR (
				CHAR_LENGTH(TRIM(`event_id`)) BETWEEN 1 AND 100
				AND OCTET_LENGTH(`event_id`) = OCTET_LENGTH(TRIM(`event_id`))
			)
		),
	CONSTRAINT `CK_DEVICE_OPERATION_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`operation_type`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			AND REGEXP_LIKE(`status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			AND (
				`terminal_event_type` IS NULL
				OR REGEXP_LIKE(
					`terminal_event_type`,
					'^[A-Z][A-Z0-9_]{0,49}$',
					'c'
				)
			)
			AND (
				`observed_occupancy_status` IS NULL
				OR REGEXP_LIKE(
					`observed_occupancy_status`,
					'^[A-Z][A-Z0-9_]{0,29}$',
					'c'
				)
			)
			AND (
				`observed_lock_status` IS NULL
				OR REGEXP_LIKE(
					`observed_lock_status`,
					'^[A-Z][A-Z0-9_]{0,29}$',
					'c'
				)
			)
		),
	CONSTRAINT `CK_DEVICE_OPERATION_EVIDENCE_NO_STUDENT_IDENTITY_KEY`
		CHECK (
			`evidence_payload` IS NULL
			OR JSON_CONTAINS_PATH(
				`evidence_payload`,
				'one',
				'$**.userId',
				'$**.user_id',
				'$**.studentNumber',
				'$**.student_number',
				'$**.studentId',
				'$**.student_id'
			) = 0
		),
	CONSTRAINT `FK_DEVICE_OPERATION_STATION`
		FOREIGN KEY (`station_id`) REFERENCES `station` (`station_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `FK_DEVICE_OPERATION_SLOT_STATION`
		FOREIGN KEY (`slot_id`, `station_id`)
		REFERENCES `slot` (`slot_id`, `station_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Independent device Command/Terminal ledger; no rental or return business relationship';

CREATE TABLE `settlement_payment_mutation_guard` (
	`connection_id` BIGINT UNSIGNED NOT NULL,
	`settlement_id` CHAR(36) NOT NULL,
	`expected_paid_amount` BIGINT UNSIGNED NOT NULL,
	`expected_status` VARCHAR(30) NOT NULL,
	`expected_paid_at` DATETIME(6) NULL,
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `PK_SETTLEMENT_PAYMENT_MUTATION_GUARD`
		PRIMARY KEY (`connection_id`),
	CONSTRAINT `CK_SETTLEMENT_PAYMENT_MUTATION_GUARD_STATUS`
		CHECK (`expected_status` IN ('PENDING', 'PAID'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Internal one-use trigger handshake; no application DML grants';

DELIMITER $$

CREATE TRIGGER `TRG_SETTLEMENT_BEFORE_INSERT`
BEFORE INSERT ON `settlement`
FOR EACH ROW
BEGIN
	IF `NEW`.`paid_amount` <> 0
		OR `NEW`.`paid_at` IS NOT NULL
		OR `NEW`.`status` = 'PAID' THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'SETTLEMENT_MUST_START_WITHOUT_CREDIT';
	END IF;
END$$

CREATE TRIGGER `TRG_SETTLEMENT_PAYMENT_BEFORE_UPDATE`
BEFORE UPDATE ON `settlement`
FOR EACH ROW
BEGIN
	DECLARE `guard_consumed` INT DEFAULT 0;
	DECLARE `allowed_unpaid_cancel` BOOLEAN DEFAULT FALSE;
	DECLARE `allowed_upward_reprice` BOOLEAN DEFAULT FALSE;

	IF `OLD`.`damage_inspection_id` IS NOT NULL
		AND (
			`NEW`.`reason` <> `OLD`.`reason`
			OR NOT (
				`NEW`.`damage_inspection_id`
					<=> `OLD`.`damage_inspection_id`
			)
		) THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'DAMAGE_SETTLEMENT_BASIS_IMMUTABLE';
	END IF;

	SET `allowed_unpaid_cancel` = (
		`OLD`.`status` = 'PENDING'
		AND `NEW`.`status` = 'CANCELLED'
		AND `OLD`.`paid_amount` = 0
		AND `NEW`.`paid_amount` = 0
		AND `OLD`.`paid_at` IS NULL
		AND `NEW`.`paid_at` IS NULL
	);

	SET `allowed_upward_reprice` = (
		`OLD`.`status` = 'PAID'
		AND `NEW`.`status` = 'PENDING'
		AND `OLD`.`paid_amount` = `NEW`.`paid_amount`
		AND `NEW`.`amount` > `OLD`.`amount`
		AND `NEW`.`paid_amount` < `NEW`.`amount`
		AND `OLD`.`paid_at` IS NOT NULL
		AND `NEW`.`paid_at` IS NULL
	);

	IF `NEW`.`paid_amount` <> `OLD`.`paid_amount` THEN
		DELETE FROM `settlement_payment_mutation_guard`
		WHERE `connection_id` = CONNECTION_ID()
			AND `settlement_id` = `OLD`.`settlement_id`
			AND `expected_paid_amount` = `NEW`.`paid_amount`
			AND `expected_status` = `NEW`.`status`
			AND `expected_paid_at` <=> `NEW`.`paid_at`;

		SET `guard_consumed` = ROW_COUNT();

		IF `guard_consumed` <> 1 THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'SETTLEMENT_PAYMENT_FIELDS_MANAGED';
		END IF;
	ELSEIF `NEW`.`status` <> `OLD`.`status`
		OR NOT (`NEW`.`paid_at` <=> `OLD`.`paid_at`) THEN
		IF NOT `allowed_unpaid_cancel`
			AND NOT `allowed_upward_reprice` THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'SETTLEMENT_PAYMENT_FIELDS_MANAGED';
		END IF;
	END IF;
END$$

CREATE TRIGGER `TRG_SETTLEMENT_DAMAGE_BASIS_BEFORE_DELETE`
BEFORE DELETE ON `settlement`
FOR EACH ROW
BEGIN
	IF `OLD`.`damage_inspection_id` IS NOT NULL THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'DAMAGE_SETTLEMENT_DELETE_FORBIDDEN';
	END IF;
END$$

CREATE TRIGGER `TRG_DAMAGE_INSPECTION_REVIEW_AUDIT_BEFORE_UPDATE`
BEFORE UPDATE ON `damage_inspection`
FOR EACH ROW
BEGIN
	DECLARE `referencing_settlement_id` CHAR(36) DEFAULT NULL;
	DECLARE CONTINUE HANDLER FOR NOT FOUND
		SET `referencing_settlement_id` = NULL;

	IF NOT (`NEW`.`admin_decision` <=> `OLD`.`admin_decision`)
		OR NOT (`NEW`.`reviewed_by` <=> `OLD`.`reviewed_by`)
		OR NOT (`NEW`.`reviewed_at` <=> `OLD`.`reviewed_at`) THEN
		SELECT `settlement_id`
		INTO `referencing_settlement_id`
		FROM `settlement`
		WHERE `damage_inspection_id` = `OLD`.`inspection_id`
		LIMIT 1
		FOR UPDATE;

		IF `referencing_settlement_id` IS NOT NULL THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT =
					'SETTLED_DAMAGE_REVIEW_AUDIT_IMMUTABLE';
		END IF;
	END IF;
END$$

CREATE TRIGGER `TRG_RETURN_ATTEMPT_BEFORE_INSERT`
BEFORE INSERT ON `return_attempt`
FOR EACH ROW
BEGIN
	DECLARE `rental_status_value` VARCHAR(30) DEFAULT NULL;
	DECLARE CONTINUE HANDLER FOR NOT FOUND
		SET `rental_status_value` = NULL;

	IF `NEW`.`status` <> 'FAILED' THEN
		SELECT `status`
		INTO `rental_status_value`
		FROM `rental`
		WHERE `rental_id` = `NEW`.`rental_id`
		FOR UPDATE;

		IF `rental_status_value` <> 'RETURNING'
			OR `rental_status_value` IS NULL THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'RETURN_RENTAL_NOT_RETURNING';
		END IF;
	END IF;

	IF `NEW`.`status` = 'COMPLETED' THEN
		UPDATE `rental`
		SET
			`status` = 'COMPLETED',
			`ended_at` = `NEW`.`completed_at`
		WHERE `rental_id` = `NEW`.`rental_id`
			AND `status` = 'RETURNING';

		IF ROW_COUNT() <> 1 THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'RETURN_RENTAL_COMPLETION_CONFLICT';
		END IF;
	END IF;
END$$

CREATE TRIGGER `TRG_RETURN_ATTEMPT_BEFORE_UPDATE`
BEFORE UPDATE ON `return_attempt`
FOR EACH ROW
BEGIN
	DECLARE `rental_status_value` VARCHAR(30) DEFAULT NULL;
	DECLARE CONTINUE HANDLER FOR NOT FOUND
		SET `rental_status_value` = NULL;

	IF `NEW`.`rental_id` <> `OLD`.`rental_id` THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'RETURN_RENTAL_IMMUTABLE';
	END IF;

	IF `OLD`.`status` = 'COMPLETED'
		AND (
			`NEW`.`status` <> 'COMPLETED'
			OR NOT (`NEW`.`completed_at` <=> `OLD`.`completed_at`)
			OR NOT (
				`NEW`.`physical_completed_at`
					<=> `OLD`.`physical_completed_at`
			)
			OR NOT (`NEW`.`return_slot_id` <=> `OLD`.`return_slot_id`)
		) THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'COMPLETED_RETURN_IS_TERMINAL';
	END IF;

	IF `OLD`.`status` <> 'COMPLETED'
		AND `NEW`.`status` <> 'FAILED' THEN
		SELECT `status`
		INTO `rental_status_value`
		FROM `rental`
		WHERE `rental_id` = `NEW`.`rental_id`
		FOR UPDATE;

		IF `rental_status_value` <> 'RETURNING'
			OR `rental_status_value` IS NULL THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'RETURN_RENTAL_NOT_RETURNING';
		END IF;
	END IF;

	IF `OLD`.`status` <> 'COMPLETED'
		AND `NEW`.`status` = 'COMPLETED' THEN
		UPDATE `rental`
		SET
			`status` = 'COMPLETED',
			`ended_at` = `NEW`.`completed_at`
		WHERE `rental_id` = `NEW`.`rental_id`
			AND `status` = 'RETURNING';

		IF ROW_COUNT() <> 1 THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'RETURN_RENTAL_COMPLETION_CONFLICT';
		END IF;
	END IF;
END$$

CREATE TRIGGER `TRG_PAYMENT_ATTEMPT_CREDIT_INSERT`
BEFORE INSERT ON `payment_attempt`
FOR EACH ROW
BEGIN
	DECLARE `settlement_amount_value` BIGINT UNSIGNED DEFAULT NULL;
	DECLARE `settlement_paid_amount_value` BIGINT UNSIGNED DEFAULT NULL;
	DECLARE `settlement_status_value` VARCHAR(30) DEFAULT NULL;
	DECLARE `next_paid_amount_value` BIGINT UNSIGNED DEFAULT NULL;
	DECLARE `next_status_value` VARCHAR(30) DEFAULT NULL;
	DECLARE `next_paid_at_value` DATETIME(6) DEFAULT NULL;
	DECLARE CONTINUE HANDLER FOR NOT FOUND
		SET `settlement_amount_value` = NULL;

	IF `NEW`.`status` = 'SUCCEEDED' THEN
		IF `NEW`.`approved_at` IS NULL
			OR `NEW`.`completed_at` IS NULL THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'SUCCEEDED_PAYMENT_REQUIRES_TERMINAL_TIMES';
		END IF;

		SELECT `amount`, `paid_amount`, `status`
		INTO
			`settlement_amount_value`,
			`settlement_paid_amount_value`,
			`settlement_status_value`
		FROM `settlement`
		WHERE `settlement_id` = `NEW`.`settlement_id`
		FOR UPDATE;

		IF `settlement_amount_value` IS NULL
			OR `settlement_status_value` <> 'PENDING'
			OR `settlement_paid_amount_value` + `NEW`.`amount`
				> `settlement_amount_value` THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE';
		END IF;

		SET `next_paid_amount_value` =
			`settlement_paid_amount_value` + `NEW`.`amount`;
		SET `next_status_value` = CASE
			WHEN `next_paid_amount_value` = `settlement_amount_value`
				THEN 'PAID'
			ELSE 'PENDING'
		END;
		SET `next_paid_at_value` = CASE
			WHEN `next_status_value` = 'PAID' THEN `NEW`.`approved_at`
			ELSE NULL
		END;

		INSERT INTO `settlement_payment_mutation_guard` (
			`connection_id`,
			`settlement_id`,
			`expected_paid_amount`,
			`expected_status`,
			`expected_paid_at`
		) VALUES (
			CONNECTION_ID(),
			`NEW`.`settlement_id`,
			`next_paid_amount_value`,
			`next_status_value`,
			`next_paid_at_value`
		);

		UPDATE `settlement`
		SET
			`paid_amount` = `next_paid_amount_value`,
			`status` = `next_status_value`,
			`paid_at` = `next_paid_at_value`
		WHERE `settlement_id` = `NEW`.`settlement_id`;

		IF ROW_COUNT() <> 1 THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'PAYMENT_SETTLEMENT_UPDATE_CONFLICT';
		END IF;
	END IF;
END$$

CREATE TRIGGER `TRG_PAYMENT_ATTEMPT_CREDIT_UPDATE`
BEFORE UPDATE ON `payment_attempt`
FOR EACH ROW
BEGIN
	DECLARE `settlement_amount_value` BIGINT UNSIGNED DEFAULT NULL;
	DECLARE `settlement_paid_amount_value` BIGINT UNSIGNED DEFAULT NULL;
	DECLARE `settlement_status_value` VARCHAR(30) DEFAULT NULL;
	DECLARE `next_paid_amount_value` BIGINT UNSIGNED DEFAULT NULL;
	DECLARE `next_status_value` VARCHAR(30) DEFAULT NULL;
	DECLARE `next_paid_at_value` DATETIME(6) DEFAULT NULL;
	DECLARE CONTINUE HANDLER FOR NOT FOUND
		SET `settlement_amount_value` = NULL;

	IF `NEW`.`settlement_id` <> `OLD`.`settlement_id`
		OR `NEW`.`amount` <> `OLD`.`amount` THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'PAYMENT_ALLOCATION_IMMUTABLE';
	END IF;

	IF `OLD`.`status` = 'SUCCEEDED'
		AND (
			`NEW`.`status` <> 'SUCCEEDED'
			OR NOT (`NEW`.`approved_at` <=> `OLD`.`approved_at`)
			OR NOT (`NEW`.`completed_at` <=> `OLD`.`completed_at`)
		) THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'SUCCEEDED_PAYMENT_IS_TERMINAL';
	END IF;

	IF `OLD`.`status` <> 'SUCCEEDED'
		AND `NEW`.`status` = 'SUCCEEDED' THEN
		IF `NEW`.`approved_at` IS NULL
			OR `NEW`.`completed_at` IS NULL THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'SUCCEEDED_PAYMENT_REQUIRES_TERMINAL_TIMES';
		END IF;

		SELECT `amount`, `paid_amount`, `status`
		INTO
			`settlement_amount_value`,
			`settlement_paid_amount_value`,
			`settlement_status_value`
		FROM `settlement`
		WHERE `settlement_id` = `NEW`.`settlement_id`
		FOR UPDATE;

		IF `settlement_amount_value` IS NULL
			OR `settlement_status_value` <> 'PENDING'
			OR `settlement_paid_amount_value` + `NEW`.`amount`
				> `settlement_amount_value` THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE';
		END IF;

		SET `next_paid_amount_value` =
			`settlement_paid_amount_value` + `NEW`.`amount`;
		SET `next_status_value` = CASE
			WHEN `next_paid_amount_value` = `settlement_amount_value`
				THEN 'PAID'
			ELSE 'PENDING'
		END;
		SET `next_paid_at_value` = CASE
			WHEN `next_status_value` = 'PAID' THEN `NEW`.`approved_at`
			ELSE NULL
		END;

		INSERT INTO `settlement_payment_mutation_guard` (
			`connection_id`,
			`settlement_id`,
			`expected_paid_amount`,
			`expected_status`,
			`expected_paid_at`
		) VALUES (
			CONNECTION_ID(),
			`NEW`.`settlement_id`,
			`next_paid_amount_value`,
			`next_status_value`,
			`next_paid_at_value`
		);

		UPDATE `settlement`
		SET
			`paid_amount` = `next_paid_amount_value`,
			`status` = `next_status_value`,
			`paid_at` = `next_paid_at_value`
		WHERE `settlement_id` = `NEW`.`settlement_id`;

		IF ROW_COUNT() <> 1 THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'PAYMENT_SETTLEMENT_UPDATE_CONFLICT';
		END IF;
	END IF;
END$$

CREATE TRIGGER `TRG_PAYMENT_ATTEMPT_BEFORE_DELETE`
BEFORE DELETE ON `payment_attempt`
FOR EACH ROW
BEGIN
	IF `OLD`.`status` = 'SUCCEEDED' THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'SUCCEEDED_PAYMENT_DELETE_FORBIDDEN';
	END IF;
END$$

DELIMITER ;
