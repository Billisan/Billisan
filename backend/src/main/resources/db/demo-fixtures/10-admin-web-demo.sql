-- V19 demo fixture: administrator authentication foundation only.
--
-- This file is intentionally outside db/migration. Run numbered demo-fixture
-- files in ascending order without the mysql --force option.
--
-- Damage inspections and administrator review decisions belong to scenario
-- scripts 30 and 40 because they require Rental and Return Attempt parents.

START TRANSACTION;

CREATE TEMPORARY TABLE `_fixture_admin_conflict_guard` (
	`record_key` VARCHAR(100) NOT NULL,
	`must_be_zero` TINYINT NOT NULL,
	CONSTRAINT `CK_FIXTURE_ADMIN_ACCOUNT_MATCH`
		CHECK (`must_be_zero` = 0)
);

-- A fixed primary key may be reused only when the entire catalog row matches.
INSERT INTO `_fixture_admin_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'admin:88000000-0000-4000-8000-000000000001', 1
FROM `admin_account` AS `actual`
WHERE `actual`.`admin_id` = '88000000-0000-4000-8000-000000000001'
	AND NOT (
		`actual`.`login_id` <=> 'admin.fixture@billisan.test'
		AND `actual`.`password_hash` <=> '$2a$10$WS6.9ytXBl7MzDCnzrKuFuLrp/xOB4BM.HRGDWCeFzNrLvjRgCF0u'
		AND `actual`.`name` <=> 'Fixture Administrator'
		AND `actual`.`created_at` <=> TIMESTAMP('2026-08-03 00:00:00.000000')
		AND `actual`.`updated_at` <=> TIMESTAMP('2026-08-03 00:00:00.000000')
	);

-- Reject a unique-login collision owned by a different administrator ID
-- before attempting an insert.
INSERT INTO `_fixture_admin_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('admin-login:', `actual`.`admin_id`), 1
FROM `admin_account` AS `actual`
WHERE `actual`.`login_id` = 'admin.fixture@billisan.test'
	AND `actual`.`admin_id` <> '88000000-0000-4000-8000-000000000001';

INSERT INTO `admin_account` (
	`admin_id`,
	`login_id`,
	`password_hash`,
	`name`,
	`created_at`,
	`updated_at`
)
SELECT
	'88000000-0000-4000-8000-000000000001',
	'admin.fixture@billisan.test',
	'$2a$10$WS6.9ytXBl7MzDCnzrKuFuLrp/xOB4BM.HRGDWCeFzNrLvjRgCF0u',
	'Fixture Administrator',
	TIMESTAMP('2026-08-03 00:00:00.000000'),
	TIMESTAMP('2026-08-03 00:00:00.000000')
WHERE NOT EXISTS (
	SELECT 1
	FROM `admin_account`
	WHERE `admin_id` = '88000000-0000-4000-8000-000000000001'
);

-- Post-insert authentication contract: one exact row, lowercase email-shaped
-- login, and a BCrypt strength-10 hash accepted by Spring Security.
INSERT INTO `_fixture_admin_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'admin-count', 1
WHERE (
	SELECT COUNT(*)
	FROM `admin_account`
	WHERE `admin_id` = '88000000-0000-4000-8000-000000000001'
) <> 1;

INSERT INTO `_fixture_admin_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('admin-login-shape:', `admin_id`), 1
FROM `admin_account`
WHERE `admin_id` = '88000000-0000-4000-8000-000000000001'
	AND (
		CAST(`login_id` AS BINARY)
			<> CAST(LOWER(TRIM(`login_id`)) AS BINARY)
		OR NOT REGEXP_LIKE(
			`login_id`,
			'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$',
			'c'
		)
	);

INSERT INTO `_fixture_admin_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('admin-bcrypt:', `admin_id`), 1
FROM `admin_account`
WHERE `admin_id` = '88000000-0000-4000-8000-000000000001'
	AND NOT REGEXP_LIKE(
		`password_hash`,
		'^[$]2[aby][$]10[$][./A-Za-z0-9]{53}$',
		'c'
	);

DROP TEMPORARY TABLE `_fixture_admin_conflict_guard`;

COMMIT;
