-- Opt-in scenario 42: partially paid overdue Settlement.
START TRANSACTION;
CREATE TEMPORARY TABLE `_scenario_42_guard` (`record_key` VARCHAR(140) NOT NULL,`must_be_zero` TINYINT NOT NULL,CHECK (`must_be_zero`=0));
-- Target: 202600006 / 3650e75c-ab2b-4455-8f00-c691fd2e66fb.
INSERT INTO `_scenario_42_guard` SELECT CONCAT('other-scenario:',`request_key`),1 FROM (
	SELECT `rental_request_id` `request_key` FROM `rental` UNION ALL SELECT `request_id` FROM `return_attempt`
	UNION ALL SELECT `request_id` FROM `damage_inspection` UNION ALL SELECT `creation_request_id` FROM `payment_attempt`
) `m` WHERE `request_key` LIKE 'fixture-scenario-%' AND `request_key` NOT LIKE 'fixture-scenario-42-%' LIMIT 1;
INSERT INTO `_scenario_42_guard` SELECT 'baseline',1
WHERE NOT EXISTS(SELECT 1 FROM `settlement` WHERE `settlement_id`='c4200000-0000-4000-8000-000000000001') AND NOT EXISTS(
	SELECT 1 FROM `user_account` `u` JOIN `rental` `r` ON `r`.`user_id`=`u`.`user_id`
	WHERE `u`.`user_id`='202600006' AND `u`.`user_ref`='3650e75c-ab2b-4455-8f00-c691fd2e66fb' AND `u`.`rental_eligible`=TRUE
		AND `r`.`rental_id`='44000000-0000-4000-8000-000000000006' AND `r`.`status`='COMPLETED'
		AND NOT EXISTS(SELECT 1 FROM `settlement` WHERE `rental_id`=`r`.`rental_id`));
INSERT INTO `_scenario_42_guard` SELECT 'partial-graph',1 WHERE
	(EXISTS(SELECT 1 FROM `settlement` WHERE `settlement_id`='c4200000-0000-4000-8000-000000000001')) <>
	(EXISTS(SELECT 1 FROM `payment_attempt` WHERE `payment_attempt_id`='c4200000-0000-4000-8000-000000000002'));
INSERT INTO `settlement` (`settlement_id`,`user_id`,`rental_id`,`damage_inspection_id`,`reason`,`amount`,`paid_amount`,`status`,`created_at`,`paid_at`,`updated_at`)
SELECT 'c4200000-0000-4000-8000-000000000001','202600006','44000000-0000-4000-8000-000000000006',NULL,'OVERDUE',2000,0,'PENDING',TIMESTAMP('2026-08-03 17:00:00'),NULL,TIMESTAMP('2026-08-03 17:00:00')
WHERE NOT EXISTS(SELECT 1 FROM `settlement` WHERE `settlement_id`='c4200000-0000-4000-8000-000000000001');
INSERT INTO `payment_attempt` (`payment_attempt_id`,`settlement_id`,`creation_request_id`,`toss_order_id`,`toss_payment_key`,`amount`,`provider`,`toss_status`,`failure_code`,`failure_message`,`status`,`requested_at`,`approved_at`,`completed_at`,`created_at`,`updated_at`)
SELECT 'c4200000-0000-4000-8000-000000000002','c4200000-0000-4000-8000-000000000001','fixture-scenario-42-partial-success','fixture-scenario-42-toss-order','fixture-scenario-42-toss-key',1000,'TOSS_SANDBOX','DONE',NULL,NULL,'SUCCEEDED',TIMESTAMP('2026-08-04 17:01:00'),TIMESTAMP('2026-08-04 17:02:00'),TIMESTAMP('2026-08-04 17:02:01'),TIMESTAMP('2026-08-04 17:01:00'),TIMESTAMP('2026-08-04 17:02:01')
WHERE NOT EXISTS(SELECT 1 FROM `payment_attempt` WHERE `payment_attempt_id`='c4200000-0000-4000-8000-000000000002');
UPDATE `settlement` SET `updated_at`=TIMESTAMP('2026-08-04 17:03:00') WHERE `settlement_id`='c4200000-0000-4000-8000-000000000001';
UPDATE `user_account` `u` SET `rental_eligible`=(`face_registered`
	AND NOT EXISTS(SELECT 1 FROM `rental` WHERE `user_id`=`u`.`user_id` AND `status` IN('REQUESTED','ACTIVE','RETURNING'))
	AND NOT EXISTS(SELECT 1 FROM `return_attempt` `a` JOIN `rental` `r` ON `r`.`rental_id`=`a`.`rental_id` WHERE `r`.`user_id`=`u`.`user_id` AND `a`.`status`='RECOVERY_REQUIRED')
	AND NOT EXISTS(SELECT 1 FROM `settlement` WHERE `user_id`=`u`.`user_id` AND `paid_amount`<`amount`)),`rental_eligibility_evaluated_at`=TIMESTAMP('2026-08-04 17:04:00'),`updated_at`=TIMESTAMP('2026-08-04 17:04:00')
WHERE `user_id`='202600006' AND `user_ref`='3650e75c-ab2b-4455-8f00-c691fd2e66fb';
INSERT INTO `_scenario_42_guard` SELECT 'postcondition',1 WHERE NOT EXISTS(
	SELECT 1 FROM `settlement` `s` JOIN `payment_attempt` `p` ON `p`.`settlement_id`=`s`.`settlement_id`
	WHERE `s`.`settlement_id`='c4200000-0000-4000-8000-000000000001' AND `s`.`user_id`='202600006'
		AND `s`.`rental_id`='44000000-0000-4000-8000-000000000006' AND `s`.`reason`='OVERDUE'
		AND `s`.`amount`=2000 AND `s`.`paid_amount`=1000 AND `s`.`status`='PENDING' AND `s`.`paid_at` IS NULL
		AND `p`.`payment_attempt_id`='c4200000-0000-4000-8000-000000000002' AND `p`.`creation_request_id`='fixture-scenario-42-partial-success'
		AND `p`.`amount`=1000 AND `p`.`provider`='TOSS_SANDBOX' AND `p`.`toss_status`='DONE' AND `p`.`status`='SUCCEEDED'
) OR NOT EXISTS(SELECT 1 FROM `user_account` WHERE `user_id`='202600006' AND `rental_eligible`=FALSE);
DROP TEMPORARY TABLE `_scenario_42_guard`; COMMIT;
