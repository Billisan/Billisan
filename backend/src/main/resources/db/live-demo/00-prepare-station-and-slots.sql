-- Live-demo operational seed. This file is not a Flyway migration.
-- It preserves existing users, face-profile links, stations, and slots.
-- Run without mysql --force so a guard failure leaves the transaction uncommitted.

START TRANSACTION;

SET @live_station_id = 'd2e2d6d6-eade-5ec7-8e3a-b7856a921d47';

INSERT INTO `station` (
	`station_id`, `name`, `service_status`, `device_status`,
	`current_boot_id`, `boot_synced_at`, `last_seen_at`,
	`created_at`, `updated_at`
)
SELECT
	@live_station_id, 'Billisan Live Demo Station', 'AVAILABLE', 'ONLINE',
	NULL, NULL, NULL, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
WHERE NOT EXISTS (
	SELECT 1 FROM `station` WHERE `station_id` = @live_station_id
);

-- Preserve existing physical IDs. Generate an ID only when the numbered slot
-- does not exist; the final SELECT must then be copied to the Pi configuration.
SET @live_rent_slot_id = COALESCE(
	(
		SELECT `slot_id`
		FROM `slot`
		WHERE `station_id` = @live_station_id AND `slot_number` = 1
		LIMIT 1
	),
	UUID()
);

SET @live_return_slot_id = COALESCE(
	(
		SELECT `slot_id`
		FROM `slot`
		WHERE `station_id` = @live_station_id AND `slot_number` = 2
		LIMIT 1
	),
	UUID()
);

INSERT INTO `slot` (
	`slot_id`, `station_id`, `slot_number`, `service_status`,
	`occupancy_status`, `lock_status`, `item_condition`,
	`created_at`, `updated_at`
)
SELECT
	@live_rent_slot_id, @live_station_id, 1, 'AVAILABLE',
	'OCCUPIED', 'LOCKED', 'NORMAL', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
WHERE NOT EXISTS (
	SELECT 1
	FROM `slot`
	WHERE `station_id` = @live_station_id AND `slot_number` = 1
);

INSERT INTO `slot` (
	`slot_id`, `station_id`, `slot_number`, `service_status`,
	`occupancy_status`, `lock_status`, `item_condition`,
	`created_at`, `updated_at`
)
SELECT
	@live_return_slot_id, @live_station_id, 2, 'AVAILABLE',
	'EMPTY', 'LOCKED', 'EMPTY', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
WHERE NOT EXISTS (
	SELECT 1
	FROM `slot`
	WHERE `station_id` = @live_station_id AND `slot_number` = 2
);

CREATE TEMPORARY TABLE `_live_demo_prepare_guard` (
	`record_key` VARCHAR(100) NOT NULL,
	`must_be_zero` TINYINT NOT NULL,
	CHECK (`must_be_zero` = 0)
);

INSERT INTO `_live_demo_prepare_guard`
SELECT 'station-not-ready', 1
WHERE NOT EXISTS (
	SELECT 1
	FROM `station`
	WHERE `station_id` = @live_station_id
		AND `service_status` = 'AVAILABLE'
);

INSERT INTO `_live_demo_prepare_guard`
SELECT 'rent-slot-conflict', 1
WHERE NOT EXISTS (
	SELECT 1
	FROM `slot`
	WHERE `slot_id` = @live_rent_slot_id
		AND `station_id` = @live_station_id
		AND `slot_number` = 1
		AND `service_status` = 'AVAILABLE'
		AND `occupancy_status` = 'OCCUPIED'
		AND `lock_status` = 'LOCKED'
		AND `item_condition` = 'NORMAL'
);

INSERT INTO `_live_demo_prepare_guard`
SELECT 'return-slot-conflict', 1
WHERE NOT EXISTS (
	SELECT 1
	FROM `slot`
	WHERE `slot_id` = @live_return_slot_id
		AND `station_id` = @live_station_id
		AND `slot_number` = 2
		AND `service_status` = 'AVAILABLE'
		AND `occupancy_status` = 'EMPTY'
		AND `lock_status` = 'LOCKED'
		AND `item_condition` = 'EMPTY'
);

DROP TEMPORARY TABLE `_live_demo_prepare_guard`;
COMMIT;

SELECT
	`station_id`, `slot_id`, `slot_number`, `service_status`,
	`occupancy_status`, `lock_status`, `item_condition`
FROM `slot`
WHERE `station_id` = @live_station_id
	AND `slot_number` IN (1, 2)
ORDER BY `slot_number`;
