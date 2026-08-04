-- Opt-in scenario 43: failed payment leaves the Settlement unpaid.
START TRANSACTION;
CREATE TEMPORARY TABLE `_scenario_43_guard` (`record_key` VARCHAR(140) NOT NULL,`must_be_zero` TINYINT NOT NULL,CHECK (`must_be_zero`=0));
-- Target: 202600004 / 59b97d2b-a37d-4f75-bd33-4beb1bd3ac76.
INSERT INTO `_scenario_43_guard` SELECT CONCAT('other-scenario:',`request_key`),1 FROM (
	SELECT `rental_request_id` `request_key` FROM `rental` UNION ALL SELECT `request_id` FROM `return_attempt`
	UNION ALL SELECT `request_id` FROM `damage_inspection` UNION ALL SELECT `creation_request_id` FROM `payment_attempt`
) `m` WHERE `request_key` LIKE 'fixture-scenario-%' AND `request_key` NOT LIKE 'fixture-scenario-43-%' LIMIT 1;
INSERT INTO `_scenario_43_guard` SELECT 'baseline',1
WHERE NOT EXISTS(SELECT 1 FROM `settlement` WHERE `settlement_id`='c4300000-0000-4000-8000-000000000001') AND NOT EXISTS(
	SELECT 1 FROM `user_account` `u` JOIN `rental` `r` ON `r`.`user_id`=`u`.`user_id`
	WHERE `u`.`user_id`='202600004' AND `u`.`user_ref`='59b97d2b-a37d-4f75-bd33-4beb1bd3ac76' AND `u`.`rental_eligible`=TRUE
		AND `r`.`rental_id`='44000000-0000-4000-8000-000000000008' AND `r`.`status`='COMPLETED'
		AND NOT EXISTS(SELECT 1 FROM `settlement` WHERE `rental_id`=`r`.`rental_id`));
INSERT INTO `_scenario_43_guard` SELECT 'partial-graph',1 WHERE
	(EXISTS(SELECT 1 FROM `settlement` WHERE `settlement_id`='c4300000-0000-4000-8000-000000000001')) <>
	(EXISTS(SELECT 1 FROM `payment_attempt` WHERE `payment_attempt_id`='c4300000-0000-4000-8000-000000000002'));
INSERT INTO `settlement` (`settlement_id`,`user_id`,`rental_id`,`damage_inspection_id`,`reason`,`amount`,`paid_amount`,`status`,`created_at`,`paid_at`,`updated_at`)
SELECT 'c4300000-0000-4000-8000-000000000001','202600004','44000000-0000-4000-8000-000000000008',NULL,'OVERDUE',1000,0,'PENDING',TIMESTAMP('2026-08-04 18:00:00'),NULL,TIMESTAMP('2026-08-04 18:00:00')
WHERE NOT EXISTS(SELECT 1 FROM `settlement` WHERE `settlement_id`='c4300000-0000-4000-8000-000000000001');
INSERT INTO `payment_attempt` (`payment_attempt_id`,`settlement_id`,`creation_request_id`,`toss_order_id`,`toss_payment_key`,`amount`,`provider`,`toss_status`,`failure_code`,`failure_message`,`status`,`requested_at`,`approved_at`,`completed_at`,`created_at`,`updated_at`)
SELECT 'c4300000-0000-4000-8000-000000000002','c4300000-0000-4000-8000-000000000001','fixture-scenario-43-payment-failed','fixture-scenario-43-toss-order','fixture-scenario-43-toss-key',1000,'TOSS_SANDBOX','ABORTED','FIXTURE_PAYMENT_DECLINED','Scenario payment was rejected','FAILED',TIMESTAMP('2026-08-04 18:01:00'),NULL,TIMESTAMP('2026-08-04 18:01:30'),TIMESTAMP('2026-08-04 18:01:00'),TIMESTAMP('2026-08-04 18:01:30')
WHERE NOT EXISTS(SELECT 1 FROM `payment_attempt` WHERE `payment_attempt_id`='c4300000-0000-4000-8000-000000000002');
UPDATE `user_account` `u` SET `rental_eligible`=(`face_registered`
	AND NOT EXISTS(SELECT 1 FROM `rental` WHERE `user_id`=`u`.`user_id` AND `status` IN('REQUESTED','ACTIVE','RETURNING'))
	AND NOT EXISTS(SELECT 1 FROM `return_attempt` `a` JOIN `rental` `r` ON `r`.`rental_id`=`a`.`rental_id` WHERE `r`.`user_id`=`u`.`user_id` AND `a`.`status`='RECOVERY_REQUIRED')
	AND NOT EXISTS(SELECT 1 FROM `settlement` WHERE `user_id`=`u`.`user_id` AND `paid_amount`<`amount`)),`rental_eligibility_evaluated_at`=TIMESTAMP('2026-08-04 18:02:00'),`updated_at`=TIMESTAMP('2026-08-04 18:02:00')
WHERE `user_id`='202600004' AND `user_ref`='59b97d2b-a37d-4f75-bd33-4beb1bd3ac76';
INSERT INTO `_scenario_43_guard` SELECT 'postcondition',1 WHERE NOT EXISTS(
	SELECT 1 FROM `settlement` `s` JOIN `payment_attempt` `p` ON `p`.`settlement_id`=`s`.`settlement_id`
	WHERE `s`.`settlement_id`='c4300000-0000-4000-8000-000000000001' AND `s`.`user_id`='202600004'
		AND `s`.`rental_id`='44000000-0000-4000-8000-000000000008' AND `s`.`reason`='OVERDUE' AND `s`.`amount`=1000
		AND `s`.`paid_amount`=0 AND `s`.`status`='PENDING' AND `s`.`paid_at` IS NULL
		AND `p`.`payment_attempt_id`='c4300000-0000-4000-8000-000000000002' AND `p`.`creation_request_id`='fixture-scenario-43-payment-failed'
		AND `p`.`amount`=1000 AND `p`.`provider`='TOSS_SANDBOX' AND `p`.`toss_status`='ABORTED'
		AND `p`.`status`='FAILED' AND `p`.`failure_code`='FIXTURE_PAYMENT_DECLINED'
) OR NOT EXISTS(SELECT 1 FROM `user_account` WHERE `user_id`='202600004' AND `rental_eligible`=FALSE);
DROP TEMPORARY TABLE `_scenario_43_guard`; COMMIT;
