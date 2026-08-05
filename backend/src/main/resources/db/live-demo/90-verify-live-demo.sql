-- Read-only preflight for the project-only live demonstration database.

SET @live_station_id = 'd2e2d6d6-eade-5ec7-8e3a-b7856a921d47';

SELECT
	`station_id`, `name`, `service_status`, `device_status`,
	`current_boot_id`, `boot_synced_at`, `last_seen_at`
FROM `station`
WHERE `station_id` = @live_station_id;

SELECT
	`s`.`slot_id`,
	`s`.`slot_number`,
	`s`.`service_status`,
	`s`.`occupancy_status`,
	`s`.`lock_status`,
	`s`.`item_condition`,
	EXISTS (
		SELECT 1
		FROM `rental` AS `r`
		WHERE `r`.`checkout_slot_id` = `s`.`slot_id`
			AND `r`.`status` = 'REQUESTED'
	) AS `requested_rental_block`,
	EXISTS (
		SELECT 1
		FROM `return_attempt` AS `ra`
		WHERE `ra`.`return_slot_id` = `s`.`slot_id`
			AND `ra`.`status` IN ('PROCESSING', 'PHYSICAL_DONE', 'RECOVERY_REQUIRED')
	) AS `open_return_block`,
	(
		`s`.`service_status` = 'AVAILABLE'
		AND `s`.`occupancy_status` = 'OCCUPIED'
		AND `s`.`lock_status` = 'LOCKED'
		AND `s`.`item_condition` = 'NORMAL'
	) AS `physical_rent_candidate`,
	(
		`s`.`service_status` = 'AVAILABLE'
		AND `s`.`occupancy_status` = 'EMPTY'
		AND `s`.`lock_status` = 'LOCKED'
	) AS `physical_return_candidate`
FROM `slot` AS `s`
WHERE `s`.`station_id` = @live_station_id
ORDER BY `s`.`slot_number`;

SELECT
	`rental_id`, `user_id`, `checkout_slot_id`, `rental_request_id`,
	`status`, `requested_at`, `rented_at`, `due_at`
FROM `rental`
WHERE `status` = 'REQUESTED'
ORDER BY `requested_at`;

SELECT
	`operation_id`, `station_id`, `slot_id`, `command_id`,
	`operation_type`, `status`, `requested_at`, `acked_at`, `completed_at`
FROM `device_operation`
WHERE `station_id` = @live_station_id
	AND `status` IN ('REQUESTED', 'ACKED', 'OUTCOME_UNKNOWN')
ORDER BY `requested_at`;

SELECT
	`user_id`, `user_ref`, `login_id`, `face_registered`,
	`rental_eligible`, `rental_eligibility_evaluated_at`
FROM `user_account`
ORDER BY `user_id`;
