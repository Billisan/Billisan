-- P1-2: Spring-authoritative AI inspection request and terminal-result times.
--
-- requested_at is when Spring durably accepts the inspection request.
-- completed_at is when Spring durably stores the terminal AI success/failure.
-- These timestamps measure end-to-end orchestration, not Orin-only inference
-- duration. All values are UTC DATETIME(6).

ALTER TABLE `damage_inspection`
	ADD COLUMN `requested_at` DATETIME(6) NULL
		COMMENT 'UTC time when Spring durably accepted the AI inspection request'
		AFTER `request_id`,
	ADD COLUMN `completed_at` DATETIME(6) NULL
		COMMENT 'UTC time when Spring durably stored the terminal AI result'
		AFTER `model_version`;

-- Legacy rows predate explicit AI processing timestamps. created_at is the
-- nearest trustworthy request boundary. For terminal rows, reviewed_at is
-- preferred when available so the inferred completion cannot follow review;
-- otherwise updated_at is used. These are migration approximations only.
UPDATE `damage_inspection`
SET
	`requested_at` = `created_at`,
	`completed_at` = CASE
		WHEN `status` IN ('COMPLETED', 'FAILED')
			THEN COALESCE(`reviewed_at`, `updated_at`, `created_at`)
		ELSE NULL
	END;

ALTER TABLE `damage_inspection`
	MODIFY COLUMN `requested_at` DATETIME(6) NOT NULL,
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_PROCESSING_STATE_TIME`
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
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_PROCESSING_TIME_ORDER`
		CHECK (
			`completed_at` IS NULL
			OR `completed_at` >= `requested_at`
		),
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_REVIEW_AFTER_PROCESSING`
		CHECK (
			`reviewed_at` IS NULL
			OR (
				`completed_at` IS NOT NULL
				AND `reviewed_at` >= `completed_at`
			)
		);
