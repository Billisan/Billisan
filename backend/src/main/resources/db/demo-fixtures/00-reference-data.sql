-- V19 demo fixture: shared Station and Slot reference data.
--
-- This file is intentionally outside db/migration. Flyway must never discover
-- or execute it. Run numbered demo-fixture files in ascending order without
-- the mysql --force option so a validation error stops the client.
--
-- Reapplication contract:
-- - insert only a missing fixed primary key;
-- - never overwrite an existing row;
-- - validate stable reference columns before and after insertion;
-- - leave final mutable Slot states to scenario scripts 30 and 40.

START TRANSACTION;

CREATE TEMPORARY TABLE `_fixture_reference_conflict_guard` (
	`record_key` VARCHAR(100) NOT NULL,
	`must_be_zero` TINYINT NOT NULL,
	CONSTRAINT `CK_FIXTURE_REFERENCE_DATA_MATCH`
		CHECK (`must_be_zero` = 0)
);

-- Fail before DML if an existing fixed Station ID has different content.
INSERT INTO `_fixture_reference_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'station:22000000-0000-4000-8000-000000000001', 1
FROM `station` AS `s`
WHERE `s`.`station_id` = '22000000-0000-4000-8000-000000000001'
	AND NOT (
		`s`.`name` <=> 'Fixture Station 01'
		AND `s`.`service_status` <=> 'AVAILABLE'
		AND `s`.`device_status` <=> 'ONLINE'
		AND `s`.`current_boot_id` <=> 'fixture-boot-station-01'
		AND `s`.`boot_synced_at` <=> TIMESTAMP('2026-08-03 00:00:00.000000')
		AND `s`.`last_seen_at` <=> TIMESTAMP('2026-08-03 00:00:00.000000')
		AND `s`.`created_at` <=> TIMESTAMP('2026-08-03 00:00:00.000000')
		AND `s`.`updated_at` <=> TIMESTAMP('2026-08-03 00:00:00.000000')
	);

-- Existing fixed Slot IDs may already have their final scenario states. Stage
-- 00 owns only their immutable identity, parent Station, number, and creation
-- timestamp. Later scripts own updated_at and the four mutable state columns.
INSERT INTO `_fixture_reference_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('slot:', `expected`.`slot_id`), 1
FROM (
	SELECT '33000000-0000-4000-8000-000000000001' AS `slot_id`, 1 AS `slot_number`
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000002', 2
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000003', 3
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000004', 4
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000005', 5
) AS `expected`
INNER JOIN `slot` AS `actual`
	ON `actual`.`slot_id` = `expected`.`slot_id`
WHERE NOT (
	`actual`.`station_id` <=> '22000000-0000-4000-8000-000000000001'
	AND `actual`.`slot_number` <=> `expected`.`slot_number`
	AND `actual`.`created_at` <=> TIMESTAMP('2026-08-03 00:00:00.000000')
);

-- The fixture Station is private to this catalog. Reject an extra or remapped
-- Slot before inserting any missing catalog rows.
INSERT INTO `_fixture_reference_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('unexpected-station-slot:', `actual`.`slot_id`), 1
FROM `slot` AS `actual`
LEFT JOIN (
	SELECT '33000000-0000-4000-8000-000000000001' AS `slot_id`, 1 AS `slot_number`
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000002', 2
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000003', 3
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000004', 4
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000005', 5
) AS `expected`
	ON `expected`.`slot_id` = `actual`.`slot_id`
	AND `expected`.`slot_number` = `actual`.`slot_number`
WHERE `actual`.`station_id` = '22000000-0000-4000-8000-000000000001'
	AND `expected`.`slot_id` IS NULL;

INSERT INTO `station` (
	`station_id`,
	`name`,
	`service_status`,
	`device_status`,
	`current_boot_id`,
	`boot_synced_at`,
	`last_seen_at`,
	`created_at`,
	`updated_at`
)
SELECT
	'22000000-0000-4000-8000-000000000001',
	'Fixture Station 01',
	'AVAILABLE',
	'ONLINE',
	'fixture-boot-station-01',
	TIMESTAMP('2026-08-03 00:00:00.000000'),
	TIMESTAMP('2026-08-03 00:00:00.000000'),
	TIMESTAMP('2026-08-03 00:00:00.000000'),
	TIMESTAMP('2026-08-03 00:00:00.000000')
WHERE NOT EXISTS (
	SELECT 1
	FROM `station`
	WHERE `station_id` = '22000000-0000-4000-8000-000000000001'
);

INSERT INTO `slot` (
	`slot_id`,
	`station_id`,
	`slot_number`,
	`service_status`,
	`occupancy_status`,
	`lock_status`,
	`item_condition`,
	`created_at`,
	`updated_at`
)
SELECT
	`expected`.`slot_id`,
	'22000000-0000-4000-8000-000000000001',
	`expected`.`slot_number`,
	'AVAILABLE',
	'EMPTY',
	'LOCKED',
	'EMPTY',
	TIMESTAMP('2026-08-03 00:00:00.000000'),
	TIMESTAMP('2026-08-03 00:00:00.000000')
FROM (
	SELECT '33000000-0000-4000-8000-000000000001' AS `slot_id`, 1 AS `slot_number`
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000002', 2
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000003', 3
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000004', 4
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000005', 5
) AS `expected`
WHERE NOT EXISTS (
	SELECT 1
	FROM `slot` AS `actual`
	WHERE `actual`.`slot_id` = `expected`.`slot_id`
);

-- Post-insert: exactly five catalog Slots must map to the expected Station and
-- unique numbers. The database UNIQUE keys enforce the same relationships;
-- these checks make fixture drift fail explicitly.
INSERT INTO `_fixture_reference_conflict_guard` (`record_key`, `must_be_zero`)
SELECT 'station-slot-count', 1
WHERE (
	SELECT COUNT(*)
	FROM `slot`
	WHERE `station_id` = '22000000-0000-4000-8000-000000000001'
) <> 5;

INSERT INTO `_fixture_reference_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('station-slot-number:', `slot_number`), 1
FROM `slot`
WHERE `station_id` = '22000000-0000-4000-8000-000000000001'
GROUP BY `station_id`, `slot_number`
HAVING COUNT(*) <> 1;

INSERT INTO `_fixture_reference_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('slot-station-pair:', `expected`.`slot_id`), 1
FROM (
	SELECT '33000000-0000-4000-8000-000000000001' AS `slot_id`, 1 AS `slot_number`
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000002', 2
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000003', 3
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000004', 4
	UNION ALL
	SELECT '33000000-0000-4000-8000-000000000005', 5
) AS `expected`
LEFT JOIN `slot` AS `actual`
	ON `actual`.`slot_id` = `expected`.`slot_id`
	AND `actual`.`station_id` = '22000000-0000-4000-8000-000000000001'
	AND `actual`.`slot_number` = `expected`.`slot_number`
WHERE `actual`.`slot_id` IS NULL;

-- Entity Enum membership is stricter than the V9 uppercase storage-shape
-- CHECK, so validate both contracts by accepting only Entity values here.
INSERT INTO `_fixture_reference_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('station-enum:', `station_id`), 1
FROM `station`
WHERE `station_id` = '22000000-0000-4000-8000-000000000001'
	AND (
		`service_status` NOT IN ('AVAILABLE', 'MAINTENANCE', 'OFFLINE')
		OR `device_status` NOT IN ('ONLINE', 'OFFLINE', 'ERROR')
	);

INSERT INTO `_fixture_reference_conflict_guard` (`record_key`, `must_be_zero`)
SELECT CONCAT('slot-enum:', `slot_id`), 1
FROM `slot`
WHERE `station_id` = '22000000-0000-4000-8000-000000000001'
	AND (
		`service_status` NOT IN ('AVAILABLE', 'ADMIN_REVIEW', 'OUT_OF_SERVICE')
		OR `occupancy_status` NOT IN ('EMPTY', 'OCCUPIED', 'UNKNOWN')
		OR `lock_status` NOT IN ('LOCKED', 'UNLOCKED', 'UNKNOWN', 'ERROR')
		OR (
			`item_condition` IS NOT NULL
			AND `item_condition` NOT IN (
				'EMPTY', 'NORMAL', 'DAMAGED', 'REPAIRABLE', 'UNKNOWN'
			)
		)
	);

DROP TEMPORARY TABLE `_fixture_reference_conflict_guard`;

COMMIT;
