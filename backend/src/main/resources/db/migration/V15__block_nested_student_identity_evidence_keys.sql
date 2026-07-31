-- P2 privacy hardening:
-- DEVICE_OPERATION.evidence_payload must not persist student-number identity
-- aliases at any JSON depth. V13 checked only top-level object members.
--
-- MySQL's recursive-descent JSON path also traverses objects nested inside
-- arrays. Presence is rejected independently of the member value, including
-- an explicit JSON null.

-- MySQL DDL is not transactionally rolled back. Reject legacy violations
-- before replacing the permanent CHECK constraint.
CREATE TEMPORARY TABLE `_v15_nested_evidence_empty_guard` (
	`must_be_zero` TINYINT NOT NULL,
	CONSTRAINT `CK_V15_NESTED_EVIDENCE_EMPTY_GUARD`
		CHECK (`must_be_zero` = 0)
);

INSERT INTO `_v15_nested_evidence_empty_guard` (`must_be_zero`)
SELECT 1
FROM `device_operation`
WHERE `evidence_payload` IS NOT NULL
	AND JSON_CONTAINS_PATH(
		`evidence_payload`,
		'one',
		'$**.userId',
		'$**.user_id',
		'$**.studentNumber',
		'$**.student_number',
		'$**.studentId',
		'$**.student_id'
	) = 1
LIMIT 1;

DROP TEMPORARY TABLE `_v15_nested_evidence_empty_guard`;

-- Use a new name so the replacement can be performed atomically in one ALTER
-- without dropping protection between two auto-committed DDL statements.
ALTER TABLE `device_operation`
	DROP CHECK `CK_DEVICE_OPERATION_EVIDENCE_NO_STUDENT_NUMBER`,
	ADD CONSTRAINT `CK_DEVICE_OPERATION_EVIDENCE_NO_STUDENT_IDENTITY_KEY`
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
		);
