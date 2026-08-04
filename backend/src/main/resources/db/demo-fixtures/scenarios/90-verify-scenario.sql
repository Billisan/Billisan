-- Fail-fast verification for exactly one opt-in scenario applied over the baseline.
START TRANSACTION;
CREATE TEMPORARY TABLE `_scenario_verify_guard` (
	`record_key` VARCHAR(160) NOT NULL, `must_be_zero` TINYINT NOT NULL,
	CHECK (`must_be_zero` = 0)
);
CREATE TEMPORARY TABLE `_scenario_marker` (`request_key` VARCHAR(200) NOT NULL);
INSERT INTO `_scenario_marker`
SELECT `rental_request_id` FROM `rental` WHERE `rental_request_id` LIKE 'fixture-scenario-%'
UNION ALL SELECT `request_id` FROM `return_attempt` WHERE `request_id` LIKE 'fixture-scenario-%'
UNION ALL SELECT `request_id` FROM `damage_inspection` WHERE `request_id` LIKE 'fixture-scenario-%'
UNION ALL SELECT `creation_request_id` FROM `payment_attempt` WHERE `creation_request_id` LIKE 'fixture-scenario-%';

CREATE TEMPORARY TABLE `_scenario_selected` (`scenario_code` CHAR(2) NOT NULL PRIMARY KEY);
INSERT INTO `_scenario_selected`
SELECT DISTINCT SUBSTRING(`request_key`, 18, 2) FROM `_scenario_marker`;

INSERT INTO `_scenario_verify_guard`
SELECT 'selected-scenario-count', 1
WHERE (SELECT COUNT(*) FROM `_scenario_selected`) <> 1;
INSERT INTO `_scenario_verify_guard`
SELECT CONCAT('unsupported-scenario:', `scenario_code`), 1 FROM `_scenario_selected`
WHERE `scenario_code` NOT IN ('31','32','33','34','35','36','41','42','43','44');
INSERT INTO `_scenario_verify_guard`
SELECT CONCAT('duplicate-request-key:', `request_key`), 1 FROM `_scenario_marker`
GROUP BY `request_key` HAVING COUNT(*) <> 1;

CREATE TEMPORARY TABLE `_scenario_expected_target` (
	`scenario_code` CHAR(2) NOT NULL PRIMARY KEY, `user_id` CHAR(9) NOT NULL,
	`user_ref` CHAR(36) NOT NULL, `expected_eligible` BOOLEAN NOT NULL
);
INSERT INTO `_scenario_expected_target` VALUES
	('31','202600001','f6f509d4-c001-446c-b6b7-537d65a093c3',FALSE),
	('32','202600002','f86a8791-c02b-4e50-b761-d9dd009909a9',FALSE),
	('33','202600007','bb14cac2-74d1-4b7f-a69f-aa88fcf8f55e',FALSE),
	('34','202600003','0b8255a1-70e4-45af-80f2-b38e4164ea06',TRUE),
	('35','202600004','59b97d2b-a37d-4f75-bd33-4beb1bd3ac76',TRUE),
	('36','202600005','d8a6f8d6-3c43-4789-b980-a9f6918d53b8',TRUE),
	('41','202600004','59b97d2b-a37d-4f75-bd33-4beb1bd3ac76',FALSE),
	('42','202600006','3650e75c-ab2b-4455-8f00-c691fd2e66fb',FALSE),
	('43','202600004','59b97d2b-a37d-4f75-bd33-4beb1bd3ac76',FALSE),
	('44','202600006','3650e75c-ab2b-4455-8f00-c691fd2e66fb',FALSE);

INSERT INTO `_scenario_verify_guard`
SELECT CONCAT('target-user:', `expected`.`scenario_code`), 1
FROM `_scenario_selected` `selected`
INNER JOIN `_scenario_expected_target` `expected` ON `expected`.`scenario_code`=`selected`.`scenario_code`
LEFT JOIN `user_account` `actual` ON `actual`.`user_id`=`expected`.`user_id` AND `actual`.`user_ref`=`expected`.`user_ref`
WHERE `actual`.`user_id` IS NULL OR `actual`.`rental_eligible` <> `expected`.`expected_eligible`
	OR `actual`.`rental_eligibility_evaluated_at` IS NULL;

-- Projection must equal the V19 authority calculation for every demo user.
INSERT INTO `_scenario_verify_guard`
SELECT CONCAT('projection:', `user`.`user_id`), 1 FROM `user_account` `user`
WHERE `user`.`user_id` BETWEEN '202600001' AND '202600007'
	AND `user`.`rental_eligible` <> (
		`user`.`face_registered`
		AND NOT EXISTS (SELECT 1 FROM `rental` WHERE `rental`.`user_id`=`user`.`user_id` AND `rental`.`status` IN ('REQUESTED','ACTIVE','RETURNING'))
		AND NOT EXISTS (SELECT 1 FROM `return_attempt` `attempt` INNER JOIN `rental` ON `rental`.`rental_id`=`attempt`.`rental_id` WHERE `rental`.`user_id`=`user`.`user_id` AND `attempt`.`status`='RECOVERY_REQUIRED')
		AND NOT EXISTS (SELECT 1 FROM `settlement` WHERE `settlement`.`user_id`=`user`.`user_id` AND `settlement`.`paid_amount`<`settlement`.`amount`)
	);
INSERT INTO `_scenario_verify_guard`
SELECT CONCAT('projection-true-null:',`user_id`),1 FROM `user_account`
WHERE `user_id` BETWEEN '202600001' AND '202600007' AND `rental_eligible`=TRUE AND `rental_eligibility_evaluated_at` IS NULL;

-- Scenario-specific authority facts.
INSERT INTO `_scenario_verify_guard` SELECT 'scenario-31-shape',1
WHERE EXISTS(SELECT 1 FROM `_scenario_selected` WHERE `scenario_code`='31')
	AND NOT EXISTS(SELECT 1 FROM `rental` WHERE `rental_id`='b3100000-0000-4000-8000-000000000001' AND `status`='ACTIVE' AND `user_id`='202600001');
INSERT INTO `_scenario_verify_guard` SELECT 'scenario-32-shape',1
WHERE EXISTS(SELECT 1 FROM `_scenario_selected` WHERE `scenario_code`='32')
	AND NOT EXISTS(SELECT 1 FROM `return_attempt` `a` JOIN `rental` `r` ON `r`.`rental_id`=`a`.`rental_id` WHERE `a`.`return_attempt_id`='b3200000-0000-4000-8000-000000000002' AND `a`.`status`='RECOVERY_REQUIRED' AND `r`.`status`='RETURNING');
INSERT INTO `_scenario_verify_guard` SELECT 'scenario-33-shape',1
WHERE EXISTS(SELECT 1 FROM `_scenario_selected` WHERE `scenario_code`='33')
	AND NOT EXISTS(SELECT 1 FROM `rental` WHERE `rental_id`='b3300000-0000-4000-8000-000000000001' AND `status`='FAILED' AND `failure_code` IS NOT NULL AND `failed_at` IS NOT NULL);
INSERT INTO `_scenario_verify_guard` SELECT 'scenario-34-shape',1
WHERE EXISTS(SELECT 1 FROM `_scenario_selected` WHERE `scenario_code`='34')
	AND NOT EXISTS(SELECT 1 FROM `damage_inspection` WHERE `inspection_id`='b3400000-0000-4000-8000-000000000003' AND `status`='COMPLETED' AND `admin_decision` IS NULL);
INSERT INTO `_scenario_verify_guard` SELECT 'scenario-35-shape',1
WHERE EXISTS(SELECT 1 FROM `_scenario_selected` WHERE `scenario_code`='35')
	AND NOT EXISTS(SELECT 1 FROM `damage_inspection` WHERE `inspection_id`='b3500000-0000-4000-8000-000000000003' AND `admin_decision`='NORMAL' AND `reviewed_by` IS NOT NULL AND `reviewed_at` IS NOT NULL);
INSERT INTO `_scenario_verify_guard` SELECT 'scenario-36-shape',1
WHERE EXISTS(SELECT 1 FROM `_scenario_selected` WHERE `scenario_code`='36')
	AND NOT EXISTS(SELECT 1 FROM `settlement` `s` JOIN `damage_inspection` `i` ON `i`.`inspection_id`=`s`.`damage_inspection_id` WHERE `s`.`settlement_id`='b3600000-0000-4000-8000-000000000004' AND `s`.`reason`='DAMAGE' AND `s`.`amount`=7000 AND `s`.`status`='PAID' AND `s`.`paid_amount`=7000 AND `i`.`rental_id`=`s`.`rental_id` AND `i`.`admin_decision`='DAMAGED');
INSERT INTO `_scenario_verify_guard` SELECT CONCAT('scenario-',`selected`.`scenario_code`,'-payment-shape'),1
FROM `_scenario_selected` `selected` WHERE `selected`.`scenario_code` IN ('41','42','43','44') AND NOT EXISTS(
	SELECT 1 FROM `settlement` `s` JOIN `payment_attempt` `p` ON `p`.`settlement_id`=`s`.`settlement_id`
	WHERE `p`.`creation_request_id` LIKE CONCAT('fixture-scenario-',`selected`.`scenario_code`,'-%')
		AND `s`.`paid_amount` < `s`.`amount` AND `s`.`status`='PENDING' AND `s`.`paid_at` IS NULL
);

INSERT INTO `_scenario_verify_guard`
SELECT CONCAT('payment-total:',`s`.`settlement_id`),1 FROM `settlement` `s`
LEFT JOIN (SELECT `settlement_id`,SUM(`amount`) `total` FROM `payment_attempt` WHERE `status`='SUCCEEDED' GROUP BY `settlement_id`) `p`
	ON `p`.`settlement_id`=`s`.`settlement_id`
WHERE (`s`.`settlement_id` LIKE 'b3600000-%' OR `s`.`settlement_id` LIKE 'c4%')
	AND `s`.`paid_amount` <> COALESCE(`p`.`total`,0);
INSERT INTO `_scenario_verify_guard` SELECT 'payment-mutation-guard-leak',1
WHERE (SELECT COUNT(*) FROM `settlement_payment_mutation_guard`)<>0;

SELECT `selected`.`scenario_code`,`expected`.`user_id`,`expected`.`user_ref`,`user`.`rental_eligible`,`user`.`rental_eligibility_evaluated_at`
FROM `_scenario_selected` `selected` JOIN `_scenario_expected_target` `expected` ON `expected`.`scenario_code`=`selected`.`scenario_code`
JOIN `user_account` `user` ON `user`.`user_id`=`expected`.`user_id`;

DROP TEMPORARY TABLE `_scenario_expected_target`;
DROP TEMPORARY TABLE `_scenario_selected`;
DROP TEMPORARY TABLE `_scenario_marker`;
DROP TEMPORARY TABLE `_scenario_verify_guard`;
COMMIT;
