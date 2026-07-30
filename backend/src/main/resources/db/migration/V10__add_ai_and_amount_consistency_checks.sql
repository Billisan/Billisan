-- P1-5: Auxiliary AI-output and settlement reason/amount consistency checks.
--
-- AI failure representation:
--   status = FAILED
--   ai_result = NULL
--   confidence = NULL
-- model_version may be NULL when the failure happened before model execution;
-- if present, it must be nonblank.
--
-- Settlement amount policy:
--   DAMAGE / LOSS = exactly 7,000 KRW
--   OVERDUE      = 1,000 KRW increments from 1,000 through 6,000 KRW
--   ADJUSTMENT   = 0 through 7,000 KRW
-- The seventh overdue day is represented as LOSS, not OVERDUE.
--
-- Existing rows are intentionally not rewritten. MySQL validates existing
-- rows while adding these CHECK constraints, so inconsistent legacy data
-- blocks the migration and must be reviewed explicitly.
--
-- Cross-table rules remain Spring transaction responsibilities because MySQL
-- CHECK constraints cannot contain subqueries. These include payment attempts
-- not exceeding the outstanding settlement balance and overdue-day calculation
-- from RENTAL.due_at.

-- FAILED is a processing status, not an AI inference result. Remove it from the
-- value domain before adding the status/output relationship.
ALTER TABLE `damage_inspection`
	DROP CHECK `CK_DAMAGE_INSPECTION_AI_RESULT`;

ALTER TABLE `damage_inspection`
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_AI_RESULT`
		CHECK (
			`ai_result` IS NULL
			OR `ai_result` IN ('NORMAL', 'DAMAGED', 'UNCERTAIN')
		),
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_AI_OUTPUT_STATE`
		CHECK (
			(
				`status` = 'REQUESTED'
				AND `ai_result` IS NULL
				AND `confidence` IS NULL
				AND `model_version` IS NULL
			)
			OR (
				`status` = 'COMPLETED'
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
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_REVIEW_COMPLETED_ONLY`
		CHECK (
			`admin_decision` IS NULL
			OR `status` = 'COMPLETED'
		);

ALTER TABLE `settlement`
	ADD CONSTRAINT `CK_SETTLEMENT_REASON_AMOUNT`
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
		);
