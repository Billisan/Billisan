-- Opt-in scenario 41: unpaid overdue Settlement with a requested payment.
START TRANSACTION;
CREATE TEMPORARY TABLE `_scenario_41_guard` (`record_key` VARCHAR(140) NOT NULL,`must_be_zero` TINYINT NOT NULL,CHECK (`must_be_zero`=0));
-- Target: 202600004 / 59b97d2b-a37d-4f75-bd33-4beb1bd3ac76.
INSERT INTO `_scenario_41_guard` SELECT CONCAT('other-scenario:',`request_key`),1 FROM (
	SELECT `rental_request_id` `request_key` FROM `rental` UNION ALL SELECT `request_id` FROM `return_attempt`
	UNION ALL SELECT `request_id` FROM `damage_inspection` UNION ALL SELECT `creation_request_id` FROM `payment_attempt`
) `m` WHERE `request_key` LIKE 'fixture-scenario-%' AND `request_key` NOT LIKE 'fixture-scenario-41-%' LIMIT 1;
INSERT INTO `_scenario_41_guard` SELECT 'baseline',1
WHERE NOT EXISTS (SELECT 1 FROM `settlement` WHERE `settlement_id`='c4100000-0000-4000-8000-000000000001') AND NOT EXISTS (
	SELECT 1 FROM `user_account` `u` INNER JOIN `rental` `r` ON `r`.`user_id`=`u`.`user_id`
	WHERE `u`.`user_id`='202600004' AND `u`.`user_ref`='59b97d2b-a37d-4f75-bd33-4beb1bd3ac76'
		AND `u`.`rental_eligible`=TRUE AND `r`.`rental_id`='44000000-0000-4000-8000-000000000008' AND `r`.`status`='COMPLETED'
		AND NOT EXISTS (SELECT 1 FROM `settlement` WHERE `rental_id`=`r`.`rental_id`));
INSERT INTO `_scenario_41_guard` SELECT 'partial-graph',1 WHERE
	(EXISTS (SELECT 1 FROM `settlement` WHERE `settlement_id`='c4100000-0000-4000-8000-000000000001')) <>
	(EXISTS (SELECT 1 FROM `payment_attempt` WHERE `payment_attempt_id`='c4100000-0000-4000-8000-000000000002'));
INSERT INTO `settlement` (`settlement_id`,`user_id`,`rental_id`,`damage_inspection_id`,`reason`,`amount`,`paid_amount`,`status`,`created_at`,`paid_at`,`updated_at`)
SELECT 'c4100000-0000-4000-8000-000000000001','202600004','44000000-0000-4000-8000-000000000008',NULL,'OVERDUE',1000,0,'PENDING',TIMESTAMP('2026-08-04 16:00:00'),NULL,TIMESTAMP('2026-08-04 16:00:00')
WHERE NOT EXISTS (SELECT 1 FROM `settlement` WHERE `settlement_id`='c4100000-0000-4000-8000-000000000001');
INSERT INTO `payment_attempt` (`payment_attempt_id`,`settlement_id`,`creation_request_id`,`toss_order_id`,`toss_payment_key`,`amount`,`provider`,`toss_status`,`failure_code`,`failure_message`,`status`,`requested_at`,`approved_at`,`completed_at`,`created_at`,`updated_at`)
SELECT 'c4100000-0000-4000-8000-000000000002','c4100000-0000-4000-8000-000000000001','fixture-scenario-41-overdue-request','fixture-scenario-41-toss-order','fixture-scenario-41-toss-key',1000,'TOSS_SANDBOX',NULL,NULL,NULL,'REQUESTED',TIMESTAMP('2026-08-04 16:01:00'),NULL,NULL,TIMESTAMP('2026-08-04 16:01:00'),TIMESTAMP('2026-08-04 16:01:00')
WHERE NOT EXISTS (SELECT 1 FROM `payment_attempt` WHERE `payment_attempt_id`='c4100000-0000-4000-8000-000000000002');
UPDATE `user_account` `u` SET `rental_eligible`=(`face_registered`
	AND NOT EXISTS(SELECT 1 FROM `rental` WHERE `user_id`=`u`.`user_id` AND `status` IN('REQUESTED','ACTIVE','RETURNING'))
	AND NOT EXISTS(SELECT 1 FROM `return_attempt` `a` JOIN `rental` `r` ON `r`.`rental_id`=`a`.`rental_id` WHERE `r`.`user_id`=`u`.`user_id` AND `a`.`status`='RECOVERY_REQUIRED')
	AND NOT EXISTS(SELECT 1 FROM `settlement` WHERE `user_id`=`u`.`user_id` AND `paid_amount`<`amount`)),`rental_eligibility_evaluated_at`=TIMESTAMP('2026-08-04 16:02:00'),`updated_at`=TIMESTAMP('2026-08-04 16:02:00')
WHERE `user_id`='202600004' AND `user_ref`='59b97d2b-a37d-4f75-bd33-4beb1bd3ac76';
INSERT INTO `_scenario_41_guard` SELECT 'postcondition',1 WHERE NOT EXISTS (
	SELECT 1 FROM `settlement` `s` JOIN `payment_attempt` `p` ON `p`.`settlement_id`=`s`.`settlement_id`
	WHERE `s`.`settlement_id`='c4100000-0000-4000-8000-000000000001' AND `s`.`user_id`='202600004'
		AND `s`.`rental_id`='44000000-0000-4000-8000-000000000008' AND `s`.`reason`='OVERDUE' AND `s`.`amount`=1000
		AND `s`.`paid_amount`=0 AND `s`.`status`='PENDING' AND `s`.`paid_at` IS NULL
		AND `p`.`payment_attempt_id`='c4100000-0000-4000-8000-000000000002' AND `p`.`creation_request_id`='fixture-scenario-41-overdue-request'
		AND `p`.`amount`=1000 AND `p`.`provider`='TOSS_SANDBOX' AND `p`.`toss_status` IS NULL AND `p`.`status`='REQUESTED'
) OR NOT EXISTS(SELECT 1 FROM `user_account` WHERE `user_id`='202600004' AND `rental_eligible`=FALSE);
DROP TEMPORARY TABLE `_scenario_41_guard`; COMMIT;
