-- V19 demo fixture: application-login users and eligibility projections.
--
-- This file is intentionally outside db/migration. Run numbered demo-fixture
-- files in ascending order without the mysql --force option.
--
-- Stage 20 establishes the shared baseline: six Orin-linked users are face
-- registered and eligible, while the seventh user is face-unregistered and
-- ineligible. Later scenario scripts may change authoritative business state
-- and must then recompute the affected projections.

START TRANSACTION;

CREATE TEMPORARY TABLE `_fixture_expected_user` (
	`scenario_key` VARCHAR(40) NOT NULL,
	`user_id` CHAR(9) NOT NULL,
	`user_ref` CHAR(36) NOT NULL,
	`login_id` VARCHAR(254) NOT NULL,
	`password_hash` VARCHAR(255) NOT NULL,
	`name` VARCHAR(100) NOT NULL,
	`face_registered` BOOLEAN NOT NULL,
	`rental_eligible` BOOLEAN NOT NULL,
	`rental_eligibility_evaluated_at` DATETIME(6) NULL,
	`created_at` DATETIME(6) NOT NULL,
	`updated_at` DATETIME(6) NOT NULL,
	PRIMARY KEY (`user_id`),
	UNIQUE (`user_ref`),
	UNIQUE (`login_id`)
);

INSERT INTO `_fixture_expected_user` (
	`scenario_key`,
	`user_id`,
	`user_ref`,
	`login_id`,
	`password_hash`,
	`name`,
	`face_registered`,
	`rental_eligible`,
	`rental_eligibility_evaluated_at`,
	`created_at`,
	`updated_at`
)
VALUES
	(
		'demo-user-01',
		'202600001',
		'f6f509d4-c001-446c-b6b7-537d65a093c3',
		'demo01.fixture@billisan.test',
		'$2a$10$WS6.9ytXBl7MzDCnzrKuFuLrp/xOB4BM.HRGDWCeFzNrLvjRgCF0u',
		'김민준',
		TRUE,
		TRUE,
		TIMESTAMP('2026-08-03 00:00:00.000000'),
		TIMESTAMP('2026-08-01 00:00:00.000000'),
		TIMESTAMP('2026-08-03 00:00:00.000000')
	),
	(
		'demo-user-02',
		'202600002',
		'f86a8791-c02b-4e50-b761-d9dd009909a9',
		'demo02.fixture@billisan.test',
		'$2a$10$WS6.9ytXBl7MzDCnzrKuFuLrp/xOB4BM.HRGDWCeFzNrLvjRgCF0u',
		'이서연',
		TRUE,
		TRUE,
		TIMESTAMP('2026-08-03 00:00:00.000000'),
		TIMESTAMP('2026-08-01 00:00:00.000000'),
		TIMESTAMP('2026-08-03 00:00:00.000000')
	),
	(
		'demo-user-03',
		'202600003',
		'0b8255a1-70e4-45af-80f2-b38e4164ea06',
		'demo03.fixture@billisan.test',
		'$2a$10$WS6.9ytXBl7MzDCnzrKuFuLrp/xOB4BM.HRGDWCeFzNrLvjRgCF0u',
		'박지호',
		TRUE,
		TRUE,
		TIMESTAMP('2026-08-03 00:00:00.000000'),
		TIMESTAMP('2026-08-01 00:00:00.000000'),
		TIMESTAMP('2026-08-03 00:00:00.000000')
	),
	(
		'demo-user-04',
		'202600004',
		'59b97d2b-a37d-4f75-bd33-4beb1bd3ac76',
		'demo04.fixture@billisan.test',
		'$2a$10$WS6.9ytXBl7MzDCnzrKuFuLrp/xOB4BM.HRGDWCeFzNrLvjRgCF0u',
		'최수아',
		TRUE,
		TRUE,
		TIMESTAMP('2026-08-03 00:00:00.000000'),
		TIMESTAMP('2026-08-01 00:00:00.000000'),
		TIMESTAMP('2026-08-03 00:00:00.000000')
	),
	(
		'demo-user-05',
		'202600005',
		'd8a6f8d6-3c43-4789-b980-a9f6918d53b8',
		'demo05.fixture@billisan.test',
		'$2a$10$WS6.9ytXBl7MzDCnzrKuFuLrp/xOB4BM.HRGDWCeFzNrLvjRgCF0u',
		'정예준',
		TRUE,
		TRUE,
		TIMESTAMP('2026-08-03 00:00:00.000000'),
		TIMESTAMP('2026-08-01 00:00:00.000000'),
		TIMESTAMP('2026-08-03 00:00:00.000000')
	),
	(
		'demo-user-06',
		'202600006',
		'3650e75c-ab2b-4455-8f00-c691fd2e66fb',
		'demo06.fixture@billisan.test',
		'$2a$10$WS6.9ytXBl7MzDCnzrKuFuLrp/xOB4BM.HRGDWCeFzNrLvjRgCF0u',
		'강하은',
		TRUE,
		TRUE,
		TIMESTAMP('2026-08-03 00:00:00.000000'),
		TIMESTAMP('2026-08-01 00:00:00.000000'),
		TIMESTAMP('2026-08-03 00:00:00.000000')
	),
	(
		'face-unregistered',
		'202600007',
		'bb14cac2-74d1-4b7f-a69f-aa88fcf8f55e',
		'face-unregistered.fixture@billisan.test',
		'$2a$10$WS6.9ytXBl7MzDCnzrKuFuLrp/xOB4BM.HRGDWCeFzNrLvjRgCF0u',
		'얼굴 미등록 사용자',
		FALSE,
		FALSE,
		TIMESTAMP('2026-08-03 00:00:00.000000'),
		TIMESTAMP('2026-08-01 00:00:00.000000'),
		TIMESTAMP('2026-08-03 00:00:00.000000')
	);

CREATE TEMPORARY TABLE `_fixture_user_conflict_guard` (
	`record_key` VARCHAR(100) NOT NULL,
	`must_be_zero` TINYINT NOT NULL,
	CONSTRAINT `CK_FIXTURE_USER_ACCOUNT_MATCH`
		CHECK (`must_be_zero` = 0)
);

-- Existing primary keys must match every stage-20-owned value.
INSERT INTO `_fixture_user_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('user:', `expected`.`user_id`), 1
FROM `_fixture_expected_user` AS `expected`
INNER JOIN `user_account` AS `actual`
	ON `actual`.`user_id` = `expected`.`user_id`
WHERE NOT (
	`actual`.`user_ref` <=> `expected`.`user_ref`
	AND `actual`.`login_id` <=> `expected`.`login_id`
	AND `actual`.`password_hash` <=> `expected`.`password_hash`
	AND `actual`.`name` <=> `expected`.`name`
	AND `actual`.`face_registered` <=> `expected`.`face_registered`
	AND `actual`.`rental_eligible` <=> `expected`.`rental_eligible`
	AND `actual`.`rental_eligibility_evaluated_at`
		<=> `expected`.`rental_eligibility_evaluated_at`
	AND `actual`.`created_at` <=> `expected`.`created_at`
	AND `actual`.`updated_at` <=> `expected`.`updated_at`
);

-- A user_ref or login collision owned by a different student-number PK is a
-- hard conflict, not an upsert target.
INSERT INTO `_fixture_user_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('user-unique:', `actual`.`user_id`), 1
FROM `user_account` AS `actual`
INNER JOIN `_fixture_expected_user` AS `expected`
	ON `actual`.`user_ref` = `expected`.`user_ref`
	OR `actual`.`login_id` = `expected`.`login_id`
WHERE `actual`.`user_id` <> `expected`.`user_id`;

INSERT INTO `user_account` (
	`user_id`,
	`user_ref`,
	`login_id`,
	`password_hash`,
	`name`,
	`face_registered`,
	`rental_eligible`,
	`rental_eligibility_evaluated_at`,
	`created_at`,
	`updated_at`
)
SELECT
	`expected`.`user_id`,
	`expected`.`user_ref`,
	`expected`.`login_id`,
	`expected`.`password_hash`,
	`expected`.`name`,
	`expected`.`face_registered`,
	`expected`.`rental_eligible`,
	`expected`.`rental_eligibility_evaluated_at`,
	`expected`.`created_at`,
	`expected`.`updated_at`
FROM `_fixture_expected_user` AS `expected`
LEFT JOIN `user_account` AS `actual`
	ON `actual`.`user_id` = `expected`.`user_id`
WHERE `actual`.`user_id` IS NULL;

INSERT INTO `_fixture_user_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'user-count', 1
WHERE (
	SELECT COUNT(*)
	FROM `user_account` AS `actual`
	INNER JOIN `_fixture_expected_user` AS `expected`
		ON `actual`.`user_id` = `expected`.`user_id`
) <> 7;

INSERT INTO `_fixture_user_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('user-shape:', `actual`.`user_id`), 1
FROM `user_account` AS `actual`
INNER JOIN `_fixture_expected_user` AS `expected`
	ON `actual`.`user_id` = `expected`.`user_id`
WHERE NOT REGEXP_LIKE(`actual`.`user_id`, '^[0-9]{9}$', 'c')
	OR NOT REGEXP_LIKE(
		`actual`.`user_ref`,
		'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
		'c'
	)
	OR CAST(`actual`.`login_id` AS BINARY)
		<> CAST(LOWER(TRIM(`actual`.`login_id`)) AS BINARY)
	OR NOT REGEXP_LIKE(
		`actual`.`login_id`,
		'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$',
		'c'
	)
	OR NOT REGEXP_LIKE(
		`actual`.`password_hash`,
		'^[$]2[aby][$]10[$][./A-Za-z0-9]{53}$',
		'c'
	);

-- Recheck the exact evaluated baseline projections after insertion.
INSERT INTO `_fixture_user_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('user-projection:', `expected`.`user_id`), 1
FROM `_fixture_expected_user` AS `expected`
INNER JOIN `user_account` AS `actual`
	ON `actual`.`user_id` = `expected`.`user_id`
WHERE NOT (
	`actual`.`face_registered` <=> `expected`.`face_registered`
	AND `actual`.`rental_eligible` <=> `expected`.`rental_eligible`
	AND `actual`.`rental_eligibility_evaluated_at`
		<=> `expected`.`rental_eligibility_evaluated_at`
);

-- SQL verification result. Public REST userRef corresponds to this user_ref,
-- not to the nine-digit user_id shown only for fixture diagnosis.
SELECT
	`expected`.`scenario_key`,
	`actual`.`user_id` AS `student_number_fixture_only`,
	`actual`.`user_ref` AS `rest_user_ref`,
	`actual`.`face_registered`,
	`actual`.`rental_eligible`,
	`actual`.`rental_eligibility_evaluated_at`
FROM `_fixture_expected_user` AS `expected`
INNER JOIN `user_account` AS `actual`
	ON `actual`.`user_id` = `expected`.`user_id`
ORDER BY `actual`.`user_id`;

DROP TEMPORARY TABLE `_fixture_user_conflict_guard`;
DROP TEMPORARY TABLE `_fixture_expected_user`;

COMMIT;
