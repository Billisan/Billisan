-- P1-1 Option C: standardized terminal RENTAL failure summary.
--
-- failure_message is an optional, sanitized operational summary. It must not
-- contain personal data, raw exceptions, stack traces, or full MQTT payloads.
-- That content policy is enforced by the Spring write boundary because SQL
-- cannot reliably identify every sensitive or exception-derived string.

ALTER TABLE `rental`
	ADD COLUMN `failure_code` VARCHAR(100) NULL
		COMMENT 'Stable business failure code; never a raw exception type'
		AFTER `status`,
	ADD COLUMN `failure_message` VARCHAR(500) NULL
		COMMENT 'Optional sanitized summary; no PII, stack trace, raw exception, or full MQTT payload'
		AFTER `failure_code`,
	ADD COLUMN `failed_at` DATETIME(6) NULL
		AFTER `failure_message`;

-- Existing terminal failures have no trustworthy historical cause. Preserve
-- that fact explicitly rather than inventing a current business failure code.
-- LEGACY_UNSPECIFIED is migration-only and must not be written for new RENTALs.
UPDATE `rental`
SET
	`failure_code` = 'LEGACY_UNSPECIFIED',
	`failure_message` = 'Migrated legacy FAILED row; original cause unavailable',
	`failed_at` = COALESCE(`ended_at`, `updated_at`, `created_at`, `requested_at`)
WHERE `status` = 'FAILED';

ALTER TABLE `rental`
	ADD CONSTRAINT `CK_RENTAL_FAILURE_CODE`
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
	ADD CONSTRAINT `CK_RENTAL_FAILURE_STATE`
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
	ADD CONSTRAINT `CK_RENTAL_FAILURE_TIME_ORDER`
		CHECK (
			`failed_at` IS NULL
			OR `failed_at` >= `requested_at`
		);
