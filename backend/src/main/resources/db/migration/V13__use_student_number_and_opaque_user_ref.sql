-- Identity boundary decision:
-- 1. USER_ACCOUNT.user_id is the exact nine-digit student number.
-- 2. USER_ACCOUNT.login_id is a university email and is not the student number.
-- 3. USER_ACCOUNT.user_ref is an independently generated opaque UUID.
-- 4. FACE_PROFILE_SYNC_OPERATION and Orin FACE_PROFILE use only user_ref.
-- 5. Student numbers must not cross the Spring/MySQL business boundary into
--    Kiosk, MQTT, ZeroMQ, device storage, or logs.
--
-- There is no deterministic and privacy-safe way to convert a legacy UUID
-- user_id into a real student number. This migration therefore supports the
-- current pre-production empty-user baseline only. A populated environment
-- must be migrated with an approved old-user-id -> student-number mapping
-- before an equivalent production migration is attempted.

CREATE TEMPORARY TABLE `_v13_identity_empty_guard` (
	`must_be_zero` TINYINT NOT NULL,
	CONSTRAINT `CK_V13_IDENTITY_EMPTY_GUARD`
		CHECK (`must_be_zero` = 0)
);

INSERT INTO `_v13_identity_empty_guard` (`must_be_zero`)
SELECT 1
FROM `user_account`
LIMIT 1;

DROP TEMPORARY TABLE `_v13_identity_empty_guard`;

-- Remove relationships that depend on the former UUID user_id type.
ALTER TABLE `face_profile_sync_operation`
	DROP FOREIGN KEY `FK_FACE_PROFILE_SYNC_USER`;

ALTER TABLE `settlement`
	DROP FOREIGN KEY `FK_SETTLEMENT_RENTAL_USER`;

ALTER TABLE `rental`
	DROP FOREIGN KEY `FK_RENTAL_USER`,
	DROP INDEX `UK_RENTAL_ACTIVE_USER_GUARD`,
	DROP COLUMN `active_user_guard`;

-- USER_ACCOUNT owns both identifiers:
-- - user_id: internal business PK containing the nine-digit student number
-- - user_ref: privacy-safe UUID used across the face and device boundary
ALTER TABLE `user_account`
	ADD COLUMN `user_ref`
		CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		AFTER `user_id`,
	MODIFY COLUMN `user_id`
		CHAR(9) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
		COMMENT 'Exact nine-digit student number; Spring/MySQL business boundary only',
	MODIFY COLUMN `login_id`
		VARCHAR(254) NOT NULL
		COMMENT 'Normalized university email; never the student number',
	ADD CONSTRAINT `UK_USER_ACCOUNT_USER_REF` UNIQUE (`user_ref`),
	ADD CONSTRAINT `CK_USER_ACCOUNT_STUDENT_NUMBER`
		CHECK (
			REGEXP_LIKE(`user_id`, '^[0-9]{9}$', 'c')
		),
	ADD CONSTRAINT `CK_USER_ACCOUNT_LOGIN_ID_EMAIL`
		CHECK (
			CHAR_LENGTH(`login_id`) BETWEEN 3 AND 254
			AND `login_id` = LOWER(TRIM(`login_id`))
			AND REGEXP_LIKE(
				`login_id`,
				'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$',
				'c'
			)
		),
	ADD CONSTRAINT `CK_USER_ACCOUNT_USER_REF_UUID`
		CHECK (
			REGEXP_LIKE(
				`user_ref`,
				'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
				'c'
			)
		);

-- Business ownership remains student-number based inside MySQL.
ALTER TABLE `rental`
	MODIFY COLUMN `user_id`
		CHAR(9) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	ADD COLUMN `active_user_guard`
		CHAR(9) CHARACTER SET ascii COLLATE ascii_bin
		GENERATED ALWAYS AS (
			CASE
				WHEN `status` IN ('REQUESTED', 'ACTIVE', 'RETURNING')
					THEN `user_id`
				ELSE NULL
			END
		) STORED
		AFTER `updated_at`,
	ADD CONSTRAINT `UK_RENTAL_ACTIVE_USER_GUARD`
		UNIQUE (`active_user_guard`),
	ADD CONSTRAINT `FK_RENTAL_USER`
		FOREIGN KEY (`user_id`) REFERENCES `user_account` (`user_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE `settlement`
	MODIFY COLUMN `user_id`
		CHAR(9) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	ADD CONSTRAINT `FK_SETTLEMENT_RENTAL_USER`
		FOREIGN KEY (`rental_id`, `user_id`)
		REFERENCES `rental` (`rental_id`, `user_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Face-profile synchronization is intentionally keyed by opaque user_ref.
ALTER TABLE `face_profile_sync_operation`
	CHANGE COLUMN `user_id` `user_ref`
		CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	ADD CONSTRAINT `CK_FACE_PROFILE_SYNC_USER_REF_UUID`
		CHECK (
			REGEXP_LIKE(
				`user_ref`,
				'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
				'c'
			)
		),
	ADD CONSTRAINT `FK_FACE_PROFILE_SYNC_USER_REF`
		FOREIGN KEY (`user_ref`) REFERENCES `user_account` (`user_ref`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;

-- DEVICE_OPERATION is the only MySQL device-side evidence ledger. Its
-- versioned JSON payload is flat in P0 and must not persist student-number
-- aliases. Application log redaction is tested in the Spring codebase.
ALTER TABLE `device_operation`
	ADD CONSTRAINT `CK_DEVICE_OPERATION_EVIDENCE_NO_STUDENT_NUMBER`
		CHECK (
			`evidence_payload` IS NULL
			OR JSON_CONTAINS_PATH(
				`evidence_payload`,
				'one',
				'$.userId',
				'$.user_id',
				'$.studentNumber',
				'$.student_number'
			) = 0
		);
