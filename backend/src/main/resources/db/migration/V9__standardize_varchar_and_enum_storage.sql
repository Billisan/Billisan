-- P1-4: Meaning-based VARCHAR lengths and portable Enum storage.
--
-- Active storage policy:
--   lifecycle/status and observed state  VARCHAR(30)
--   domain Enum/type/result/decision     VARCHAR(50)
--   machine-readable error/result code   VARCHAR(100)
--   human-readable detail message        VARCHAR(500)
--
-- MySQL native ENUM is intentionally prohibited. Spring/JPA must persist
-- application enums with @Enumerated(EnumType.STRING). Internal enum values
-- use case-sensitive UPPER_SNAKE_CASE so spelling and casing cannot create
-- multiple representations of one state.
--
-- External Toss values, opaque identifiers, password hashes, display names,
-- and the still-free-form RETURN_ATTEMPT.failure_reason retain their own
-- contracts and are not reclassified by this migration.

-- MySQL requires CHECK constraints that reference a modified column to be
-- removed before ALTER COLUMN and restored afterward.
ALTER TABLE `payment_attempt`
	DROP CHECK `CK_PAYMENT_PROVIDER`;

ALTER TABLE `face_profile_sync_operation`
	DROP CHECK `CK_FACE_PROFILE_SYNC_OPERATION_TYPE`;

ALTER TABLE `slot`
	MODIFY COLUMN `item_condition` VARCHAR(50) NULL;

ALTER TABLE `payment_attempt`
	MODIFY COLUMN `provider` VARCHAR(50) NOT NULL;

ALTER TABLE `face_profile_sync_operation`
	MODIFY COLUMN `operation_type` VARCHAR(50) NOT NULL;

ALTER TABLE `payment_attempt`
	ADD CONSTRAINT `CK_PAYMENT_PROVIDER`
		CHECK (`provider` IN ('MOCK', 'TOSS_SANDBOX'));

ALTER TABLE `face_profile_sync_operation`
	ADD CONSTRAINT `CK_FACE_PROFILE_SYNC_OPERATION_TYPE`
		CHECK (`operation_type` IN ('REGISTER', 'REREGISTER', 'DELETE'));

-- Generic storage-shape checks complement, but do not replace, explicit
-- business-domain checks such as CK_PAYMENT_PROVIDER. They prevent lowercase,
-- mixed-case, spaces, and punctuation from being persisted as internal Enums.
ALTER TABLE `station`
	ADD CONSTRAINT `CK_STATION_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`service_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			AND REGEXP_LIKE(`device_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
		);

ALTER TABLE `rental`
	ADD CONSTRAINT `CK_RENTAL_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
		);

ALTER TABLE `damage_inspection`
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_ENUM_STORAGE`
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
		);

ALTER TABLE `slot`
	ADD CONSTRAINT `CK_SLOT_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`service_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			AND REGEXP_LIKE(`occupancy_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			AND REGEXP_LIKE(`lock_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			AND (
				`item_condition` IS NULL
				OR REGEXP_LIKE(`item_condition`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			)
		);

ALTER TABLE `payment_attempt`
	ADD CONSTRAINT `CK_PAYMENT_ATTEMPT_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`provider`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			AND REGEXP_LIKE(`status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
		);

ALTER TABLE `return_attempt`
	ADD CONSTRAINT `CK_RETURN_ATTEMPT_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
		);

ALTER TABLE `device_operation`
	ADD CONSTRAINT `CK_DEVICE_OPERATION_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`operation_type`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			AND REGEXP_LIKE(`status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			AND (
				`terminal_event_type` IS NULL
				OR REGEXP_LIKE(`terminal_event_type`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			)
			AND (
				`observed_occupancy_status` IS NULL
				OR REGEXP_LIKE(`observed_occupancy_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			)
			AND (
				`observed_lock_status` IS NULL
				OR REGEXP_LIKE(`observed_lock_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
			)
		);

ALTER TABLE `settlement`
	ADD CONSTRAINT `CK_SETTLEMENT_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`reason`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			AND REGEXP_LIKE(`status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
		);

ALTER TABLE `face_profile_sync_operation`
	ADD CONSTRAINT `CK_FACE_PROFILE_SYNC_ENUM_STORAGE`
		CHECK (
			REGEXP_LIKE(`operation_type`, '^[A-Z][A-Z0-9_]{0,49}$', 'c')
			AND REGEXP_LIKE(`sync_status`, '^[A-Z][A-Z0-9_]{0,29}$', 'c')
		);
