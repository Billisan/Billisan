-- Opt-in scenario 36: DAMAGED decision with an immutable, fully paid settlement.
START TRANSACTION;
CREATE TEMPORARY TABLE `_scenario_36_guard` (`record_key` VARCHAR(140) NOT NULL, `must_be_zero` TINYINT NOT NULL, CHECK (`must_be_zero` = 0));

-- Target: 202600005 / d8a6f8d6-3c43-4789-b980-a9f6918d53b8.
INSERT INTO `_scenario_36_guard`
SELECT CONCAT('other-scenario:', `marker`.`request_key`), 1 FROM (
	SELECT `rental_request_id` AS `request_key` FROM `rental`
	UNION ALL SELECT `request_id` FROM `return_attempt`
	UNION ALL SELECT `request_id` FROM `damage_inspection`
	UNION ALL SELECT `creation_request_id` FROM `payment_attempt`
) `marker`
WHERE `request_key` LIKE 'fixture-scenario-%' AND `request_key` NOT LIKE 'fixture-scenario-36-%' LIMIT 1;

INSERT INTO `_scenario_36_guard`
SELECT 'baseline-user', 1
WHERE NOT EXISTS (SELECT 1 FROM `rental` WHERE `rental_id` = 'b3600000-0000-4000-8000-000000000001')
	AND NOT EXISTS (SELECT 1 FROM `user_account` WHERE `user_id` = '202600005'
		AND `user_ref` = 'd8a6f8d6-3c43-4789-b980-a9f6918d53b8' AND `rental_eligible` = TRUE);

INSERT INTO `_scenario_36_guard`
SELECT 'partial-immutable-graph', 1 WHERE (
	(EXISTS (SELECT 1 FROM `rental` WHERE `rental_id` = 'b3600000-0000-4000-8000-000000000001'))
	+ (EXISTS (SELECT 1 FROM `return_attempt` WHERE `return_attempt_id` = 'b3600000-0000-4000-8000-000000000002'))
	+ (EXISTS (SELECT 1 FROM `damage_inspection` WHERE `inspection_id` = 'b3600000-0000-4000-8000-000000000003'))
	+ (EXISTS (SELECT 1 FROM `settlement` WHERE `settlement_id` = 'b3600000-0000-4000-8000-000000000004'))
	+ (EXISTS (SELECT 1 FROM `payment_attempt` WHERE `payment_attempt_id` = 'b3600000-0000-4000-8000-000000000005'))
) NOT IN (0, 5);

INSERT INTO `rental` (`rental_id`,`user_id`,`checkout_slot_id`,`rental_request_id`,`status`,`failure_code`,`failure_message`,`failed_at`,`requested_at`,`rented_at`,`due_at`,`ended_at`,`created_at`,`updated_at`)
SELECT 'b3600000-0000-4000-8000-000000000001','202600005','33000000-0000-4000-8000-000000000001',
	'fixture-scenario-36-damaged-rental','RETURNING',NULL,NULL,NULL,
	TIMESTAMP('2026-08-04 15:00:00'),TIMESTAMP('2026-08-04 15:01:00'),TIMESTAMP('2026-08-05 15:01:00'),NULL,
	TIMESTAMP('2026-08-04 15:00:00'),TIMESTAMP('2026-08-04 15:20:00')
WHERE NOT EXISTS (SELECT 1 FROM `rental` WHERE `rental_id` = 'b3600000-0000-4000-8000-000000000001');

INSERT INTO `return_attempt` (`return_attempt_id`,`rental_id`,`return_slot_id`,`request_id`,`status`,`physical_completed_at`,`completed_at`,`failure_reason`,`created_at`,`updated_at`)
SELECT 'b3600000-0000-4000-8000-000000000002','b3600000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001',
	'fixture-scenario-36-damaged-return','COMPLETED',TIMESTAMP('2026-08-04 15:19:00'),TIMESTAMP('2026-08-04 15:20:00'),NULL,
	TIMESTAMP('2026-08-04 15:10:00'),TIMESTAMP('2026-08-04 15:20:00')
WHERE NOT EXISTS (SELECT 1 FROM `return_attempt` WHERE `return_attempt_id` = 'b3600000-0000-4000-8000-000000000002');
UPDATE `rental` SET `updated_at` = TIMESTAMP('2026-08-04 15:20:00') WHERE `rental_id` = 'b3600000-0000-4000-8000-000000000001';

INSERT INTO `damage_inspection` (`inspection_id`,`return_attempt_id`,`rental_id`,`request_id`,`requested_at`,`status`,`ai_result`,`confidence`,`model_version`,`completed_at`,`admin_decision`,`reviewed_by`,`reviewed_at`,`created_at`,`updated_at`)
SELECT 'b3600000-0000-4000-8000-000000000003','b3600000-0000-4000-8000-000000000002','b3600000-0000-4000-8000-000000000001',
	'fixture-scenario-36-damaged-inspection',TIMESTAMP('2026-08-04 15:21:00'),'COMPLETED','DAMAGED',0.9700,'fixture-ai-v1',
	TIMESTAMP('2026-08-04 15:22:00'),'DAMAGED','88000000-0000-4000-8000-000000000001',TIMESTAMP('2026-08-04 15:23:00'),
	TIMESTAMP('2026-08-04 15:21:00'),TIMESTAMP('2026-08-04 15:23:00')
WHERE NOT EXISTS (SELECT 1 FROM `damage_inspection` WHERE `inspection_id` = 'b3600000-0000-4000-8000-000000000003');

INSERT INTO `settlement` (`settlement_id`,`user_id`,`rental_id`,`damage_inspection_id`,`reason`,`amount`,`paid_amount`,`status`,`created_at`,`paid_at`,`updated_at`)
SELECT 'b3600000-0000-4000-8000-000000000004','202600005','b3600000-0000-4000-8000-000000000001',
	'b3600000-0000-4000-8000-000000000003','DAMAGE',7000,0,'PENDING',TIMESTAMP('2026-08-04 15:24:00'),NULL,TIMESTAMP('2026-08-04 15:24:00')
WHERE NOT EXISTS (SELECT 1 FROM `settlement` WHERE `settlement_id` = 'b3600000-0000-4000-8000-000000000004');

INSERT INTO `payment_attempt` (`payment_attempt_id`,`settlement_id`,`creation_request_id`,`toss_order_id`,`toss_payment_key`,`amount`,`provider`,`toss_status`,`failure_code`,`failure_message`,`status`,`requested_at`,`approved_at`,`completed_at`,`created_at`,`updated_at`)
SELECT 'b3600000-0000-4000-8000-000000000005','b3600000-0000-4000-8000-000000000004',
	'fixture-scenario-36-damage-payment','fixture-scenario-36-toss-order','fixture-scenario-36-toss-key',7000,'TOSS_SANDBOX','DONE',NULL,NULL,'SUCCEEDED',
	TIMESTAMP('2026-08-04 15:25:00'),TIMESTAMP('2026-08-04 15:26:00'),TIMESTAMP('2026-08-04 15:26:01'),TIMESTAMP('2026-08-04 15:25:00'),TIMESTAMP('2026-08-04 15:26:01')
WHERE NOT EXISTS (SELECT 1 FROM `payment_attempt` WHERE `payment_attempt_id` = 'b3600000-0000-4000-8000-000000000005');

UPDATE `settlement` SET `updated_at` = TIMESTAMP('2026-08-04 15:27:00') WHERE `settlement_id` = 'b3600000-0000-4000-8000-000000000004';
UPDATE `slot` SET `service_status`='OUT_OF_SERVICE',`occupancy_status`='OCCUPIED',`lock_status`='LOCKED',`item_condition`='DAMAGED',`updated_at`=TIMESTAMP('2026-08-04 15:27:00')
WHERE `slot_id`='33000000-0000-4000-8000-000000000001';

UPDATE `user_account` AS `user` SET `rental_eligible` = (`face_registered`
	AND NOT EXISTS (SELECT 1 FROM `rental` WHERE `rental`.`user_id`=`user`.`user_id` AND `status` IN ('REQUESTED','ACTIVE','RETURNING'))
	AND NOT EXISTS (SELECT 1 FROM `return_attempt` `a` INNER JOIN `rental` `r` ON `r`.`rental_id`=`a`.`rental_id` WHERE `r`.`user_id`=`user`.`user_id` AND `a`.`status`='RECOVERY_REQUIRED')
	AND NOT EXISTS (SELECT 1 FROM `settlement` WHERE `settlement`.`user_id`=`user`.`user_id` AND `paid_amount`<`amount`)),
	`rental_eligibility_evaluated_at`=TIMESTAMP('2026-08-04 15:28:00'),`updated_at`=TIMESTAMP('2026-08-04 15:28:00')
WHERE `user_id`='202600005' AND `user_ref`='d8a6f8d6-3c43-4789-b980-a9f6918d53b8';

INSERT INTO `_scenario_36_guard`
SELECT 'postcondition',1 WHERE NOT EXISTS (
	SELECT 1 FROM `damage_inspection` `i` INNER JOIN `settlement` `s` ON `s`.`damage_inspection_id`=`i`.`inspection_id`
	INNER JOIN `return_attempt` `a` ON `a`.`return_attempt_id`=`i`.`return_attempt_id`
	INNER JOIN `rental` `r` ON `r`.`rental_id`=`i`.`rental_id`
	INNER JOIN `payment_attempt` `p` ON `p`.`settlement_id`=`s`.`settlement_id`
	WHERE `i`.`inspection_id`='b3600000-0000-4000-8000-000000000003' AND `i`.`rental_id`=`s`.`rental_id`
		AND `r`.`user_id`='202600005' AND `r`.`rental_request_id`='fixture-scenario-36-damaged-rental' AND `r`.`status`='COMPLETED'
		AND `a`.`rental_id`=`r`.`rental_id` AND `a`.`request_id`='fixture-scenario-36-damaged-return' AND `a`.`status`='COMPLETED'
		AND `i`.`request_id`='fixture-scenario-36-damaged-inspection' AND `i`.`admin_decision`='DAMAGED'
		AND `s`.`amount`=7000 AND `s`.`paid_amount`=7000 AND `s`.`status`='PAID'
		AND `p`.`payment_attempt_id`='b3600000-0000-4000-8000-000000000005'
		AND `p`.`creation_request_id`='fixture-scenario-36-damage-payment' AND `p`.`amount`=7000 AND `p`.`status`='SUCCEEDED'
) OR NOT EXISTS (SELECT 1 FROM `user_account` WHERE `user_id`='202600005' AND `rental_eligible`=TRUE);

DROP TEMPORARY TABLE `_scenario_36_guard`;
COMMIT;
