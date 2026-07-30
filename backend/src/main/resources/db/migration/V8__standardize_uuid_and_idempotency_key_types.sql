-- P1-3: UUID entity keys and opaque idempotency-key type policy.
--
-- Entity primary keys use canonical textual UUIDs (CHAR(36)).
-- Internal request/command deduplication keys remain opaque VARCHAR(100)
-- values. They are not forced to be UUIDs because callers own their token
-- format, but they are ASCII, case-sensitive, nonblank, and unpadded.
-- Toss provider identifiers and device boot IDs are separate contracts and
-- are intentionally outside this migration.

-- FACE_PROFILE_SYNC_OPERATION was the only business table with a BIGINT PK.
-- It has no inbound FK, so legacy local surrogate values can be replaced with
-- generated UUIDs without rewriting another table.
ALTER TABLE `face_profile_sync_operation`
	DROP PRIMARY KEY,
	CHANGE COLUMN `id` `sync_operation_id` CHAR(36) NULL;

UPDATE `face_profile_sync_operation`
SET `sync_operation_id` = LOWER(UUID());

ALTER TABLE `face_profile_sync_operation`
	MODIFY COLUMN `sync_operation_id`
		CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	ADD CONSTRAINT `PK_FACE_PROFILE_SYNC_OPERATION`
		PRIMARY KEY (`sync_operation_id`),
	ADD CONSTRAINT `CK_FACE_PROFILE_SYNC_OPERATION_UUID`
		CHECK (
			REGEXP_LIKE(
				`sync_operation_id`,
				'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
				'c'
			)
		);

-- Internal HTTP/MQTT/ZeroMQ idempotency and deduplication keys share one
-- storage contract. ascii_bin makes equality and UNIQUE checks case-sensitive.
ALTER TABLE `rental`
	MODIFY COLUMN `rental_request_id`
		VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque case-sensitive idempotency key';

ALTER TABLE `damage_inspection`
	MODIFY COLUMN `request_id`
		VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque case-sensitive idempotency key';

ALTER TABLE `payment_attempt`
	MODIFY COLUMN `creation_request_id`
		VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque case-sensitive idempotency key';

ALTER TABLE `return_attempt`
	MODIFY COLUMN `request_id`
		VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque case-sensitive idempotency key';

ALTER TABLE `device_operation`
	MODIFY COLUMN `command_id`
		VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque case-sensitive command deduplication key',
	MODIFY COLUMN `event_id`
		VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL
		COMMENT 'Opaque case-sensitive terminal-event deduplication key';

ALTER TABLE `face_profile_sync_operation`
	MODIFY COLUMN `request_id`
		VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Opaque case-sensitive idempotency key';

ALTER TABLE `rental`
	ADD CONSTRAINT `CK_RENTAL_IDEMPOTENCY_KEY_SHAPE`
		CHECK (
			CHAR_LENGTH(TRIM(`rental_request_id`)) BETWEEN 1 AND 100
			AND OCTET_LENGTH(`rental_request_id`)
				= OCTET_LENGTH(TRIM(`rental_request_id`))
		);

ALTER TABLE `damage_inspection`
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_IDEMPOTENCY_KEY_SHAPE`
		CHECK (
			CHAR_LENGTH(TRIM(`request_id`)) BETWEEN 1 AND 100
			AND OCTET_LENGTH(`request_id`) = OCTET_LENGTH(TRIM(`request_id`))
		);

ALTER TABLE `payment_attempt`
	ADD CONSTRAINT `CK_PAYMENT_ATTEMPT_IDEMPOTENCY_KEY_SHAPE`
		CHECK (
			CHAR_LENGTH(TRIM(`creation_request_id`)) BETWEEN 1 AND 100
			AND OCTET_LENGTH(`creation_request_id`)
				= OCTET_LENGTH(TRIM(`creation_request_id`))
		);

ALTER TABLE `return_attempt`
	ADD CONSTRAINT `CK_RETURN_ATTEMPT_IDEMPOTENCY_KEY_SHAPE`
		CHECK (
			CHAR_LENGTH(TRIM(`request_id`)) BETWEEN 1 AND 100
			AND OCTET_LENGTH(`request_id`) = OCTET_LENGTH(TRIM(`request_id`))
		);

ALTER TABLE `device_operation`
	ADD CONSTRAINT `CK_DEVICE_OPERATION_COMMAND_KEY_SHAPE`
		CHECK (
			CHAR_LENGTH(TRIM(`command_id`)) BETWEEN 1 AND 100
			AND OCTET_LENGTH(`command_id`) = OCTET_LENGTH(TRIM(`command_id`))
		),
	ADD CONSTRAINT `CK_DEVICE_OPERATION_EVENT_KEY_SHAPE`
		CHECK (
			`event_id` IS NULL
			OR (
				CHAR_LENGTH(TRIM(`event_id`)) BETWEEN 1 AND 100
				AND OCTET_LENGTH(`event_id`) = OCTET_LENGTH(TRIM(`event_id`))
			)
		);

ALTER TABLE `face_profile_sync_operation`
	ADD CONSTRAINT `CK_FACE_PROFILE_SYNC_IDEMPOTENCY_KEY_SHAPE`
		CHECK (
			CHAR_LENGTH(TRIM(`request_id`)) BETWEEN 1 AND 100
			AND OCTET_LENGTH(`request_id`) = OCTET_LENGTH(TRIM(`request_id`))
		);
