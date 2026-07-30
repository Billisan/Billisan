-- P0-7: amount and temporal safety rules.
-- Target: MySQL 8.0.16+ with every application/database session fixed to UTC.
-- DATETIME(6) stores a UTC local representation; APIs must include an offset.

-- KRW values are non-negative integers. A Billisan rental's cumulative
-- liability and each actual payment attempt cannot exceed the P0 7,000 KRW cap.
ALTER TABLE `settlement`
	MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL,
	MODIFY COLUMN `paid_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
	ADD CONSTRAINT `CK_SETTLEMENT_AMOUNT_CAP`
		CHECK (`amount` <= 7000),
	ADD CONSTRAINT `CK_SETTLEMENT_PAYMENT_STATE`
		CHECK (
			(
				`status` = 'PAID'
				AND `paid_amount` = `amount`
				AND `paid_at` IS NOT NULL
			)
			OR
			(
				`status` = 'PENDING'
				AND `paid_amount` < `amount`
			)
			OR `status` = 'CANCELLED'
		);

ALTER TABLE `payment_attempt`
	MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL,
	ADD CONSTRAINT `CK_PAYMENT_ATTEMPT_AMOUNT_RANGE`
		CHECK (`amount` BETWEEN 1 AND 7000);

-- updated_at is a real DATETIME(6) CAS token. Any row mutation advances it even
-- when a caller forgets to set it explicitly.
ALTER TABLE `station`
	MODIFY COLUMN `updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
	ADD CONSTRAINT `CK_STATION_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`);

ALTER TABLE `slot`
	MODIFY COLUMN `updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
	ADD CONSTRAINT `CK_SLOT_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`);

ALTER TABLE `user_account`
	MODIFY COLUMN `updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
	ADD CONSTRAINT `CK_USER_ACCOUNT_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`);

ALTER TABLE `admin_account`
	MODIFY COLUMN `updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
	ADD CONSTRAINT `CK_ADMIN_ACCOUNT_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`);

ALTER TABLE `rental`
	MODIFY COLUMN `updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
	ADD CONSTRAINT `CK_RENTAL_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	ADD CONSTRAINT `CK_RENTAL_LIFECYCLE_TIME_ORDER`
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
	ADD CONSTRAINT `CK_RENTAL_STATE_TIME_COMPLETENESS`
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
		);

ALTER TABLE `return_attempt`
	MODIFY COLUMN `updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
	ADD CONSTRAINT `CK_RETURN_ATTEMPT_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	ADD CONSTRAINT `CK_RETURN_ATTEMPT_LIFECYCLE_TIME_ORDER`
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
	ADD CONSTRAINT `CK_RETURN_ATTEMPT_STATE_TIME_COMPLETENESS`
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
		);

ALTER TABLE `damage_inspection`
	MODIFY COLUMN `updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_REVIEW_TIME_ORDER`
		CHECK (`reviewed_at` IS NULL OR `reviewed_at` >= `created_at`);

ALTER TABLE `payment_attempt`
	MODIFY COLUMN `updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
	ADD CONSTRAINT `CK_PAYMENT_ATTEMPT_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	ADD CONSTRAINT `CK_PAYMENT_ATTEMPT_LIFECYCLE_TIME_ORDER`
		CHECK (
			(`approved_at` IS NULL OR `approved_at` >= `requested_at`)
			AND (`completed_at` IS NULL OR `completed_at` >= `requested_at`)
			AND (
				`approved_at` IS NULL
				OR `completed_at` IS NULL
				OR `completed_at` >= `approved_at`
			)
		),
	ADD CONSTRAINT `CK_PAYMENT_ATTEMPT_STATE_TIME_COMPLETENESS`
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
				`status` IN ('FAILED', 'CANCELLED')
				AND `completed_at` IS NOT NULL
			)
		);

ALTER TABLE `settlement`
	MODIFY COLUMN `updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
	ADD CONSTRAINT `CK_SETTLEMENT_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	ADD CONSTRAINT `CK_SETTLEMENT_PAID_TIME_ORDER`
		CHECK (`paid_at` IS NULL OR `paid_at` >= `created_at`);

ALTER TABLE `device_operation`
	MODIFY COLUMN `updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
	ADD CONSTRAINT `CK_DEVICE_OPERATION_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	ADD CONSTRAINT `CK_DEVICE_OPERATION_LIFECYCLE_TIME_ORDER`
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
	ADD CONSTRAINT `CK_DEVICE_OPERATION_STATE_TIME_COMPLETENESS`
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
				`status` IN ('SUCCEEDED', 'FAILED', 'TIMED_OUT', 'OUTCOME_UNKNOWN')
				AND `completed_at` IS NOT NULL
			)
		);

ALTER TABLE `face_profile_sync_operation`
	MODIFY COLUMN `updated_at` DATETIME(6) NOT NULL
		DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
	ADD CONSTRAINT `CK_FACE_PROFILE_SYNC_AUDIT_TIME_ORDER`
		CHECK (`updated_at` >= `created_at`),
	ADD CONSTRAINT `CK_FACE_PROFILE_SYNC_LIFECYCLE_TIME_ORDER`
		CHECK (`completed_at` IS NULL OR `completed_at` >= `requested_at`),
	ADD CONSTRAINT `CK_FACE_PROFILE_SYNC_STATE_TIME_COMPLETENESS`
		CHECK (
			(
				`sync_status` IN ('SUCCEEDED', 'FAILED')
				AND `completed_at` IS NOT NULL
			)
			OR (
				`sync_status` IN ('REQUESTED', 'PROCESSING', 'RECONCILIATION_REQUIRED')
				AND `completed_at` IS NULL
			)
		);
