-- P1 integrity hardening:
-- 1. Close nullable CHECK-expression gaps for completed AI results and Toss
--    PROCESSING/SUCCEEDED mappings.
-- 2. Enforce lowercase email storage with a binary comparison.
-- 3. Make DAMAGE settlement evidence belong to the same rental and remain an
--    administrator-reviewed DAMAGED result.
-- 4. Use one return-attempt claim for every non-failed lifecycle so a
--    completed return and a new open attempt cannot coexist.
-- 5. Serialize successful payment credits through the SETTLEMENT row so
--    concurrent attempts cannot exceed the outstanding balance.
--
-- Existing inconsistent rows are intentionally not rewritten. The ALTER
-- statements fail closed and require explicit data review before retrying.

-- MySQL DDL is not transactionally rolled back. Run every data precondition
-- before the first permanent ALTER so a rejected migration leaves no partial
-- V14 structure behind.
CREATE TEMPORARY TABLE `_v14_cross_flow_empty_guard` (
	`must_be_zero` TINYINT NOT NULL,
	CONSTRAINT `CK_V14_CROSS_FLOW_EMPTY_GUARD`
		CHECK (`must_be_zero` = 0)
);

INSERT INTO `_v14_cross_flow_empty_guard` (`must_be_zero`)
SELECT 1
FROM `user_account`
WHERE CAST(`login_id` AS BINARY)
	<> CAST(LOWER(TRIM(`login_id`)) AS BINARY)
LIMIT 1;

INSERT INTO `_v14_cross_flow_empty_guard` (`must_be_zero`)
SELECT 1
FROM `damage_inspection`
WHERE `status` = 'COMPLETED'
	AND `ai_result` IS NULL
LIMIT 1;

INSERT INTO `_v14_cross_flow_empty_guard` (`must_be_zero`)
SELECT 1
FROM `payment_attempt`
WHERE `provider` = 'TOSS_SANDBOX'
	AND `status` IN ('PROCESSING', 'SUCCEEDED')
	AND `toss_status` IS NULL
LIMIT 1;

INSERT INTO `_v14_cross_flow_empty_guard` (`must_be_zero`)
SELECT 1
FROM `return_attempt`
WHERE `status` IN (
	'PROCESSING',
	'PHYSICAL_DONE',
	'RECOVERY_REQUIRED',
	'COMPLETED'
)
GROUP BY `rental_id`
HAVING COUNT(*) > 1
LIMIT 1;

INSERT INTO `_v14_cross_flow_empty_guard` (`must_be_zero`)
SELECT 1
FROM `return_attempt` AS `ra`
JOIN `rental` AS `r`
	ON `r`.`rental_id` = `ra`.`rental_id`
WHERE (
		`ra`.`status` IN ('PROCESSING', 'PHYSICAL_DONE', 'RECOVERY_REQUIRED')
		AND `r`.`status` <> 'RETURNING'
	)
	OR (
		`ra`.`status` = 'COMPLETED'
		AND `r`.`status` <> 'COMPLETED'
	)
LIMIT 1;

INSERT INTO `_v14_cross_flow_empty_guard` (`must_be_zero`)
SELECT 1
FROM `settlement` AS `s`
JOIN `damage_inspection` AS `di`
	ON `di`.`inspection_id` = `s`.`damage_inspection_id`
JOIN `return_attempt` AS `ra`
	ON `ra`.`return_attempt_id` = `di`.`return_attempt_id`
WHERE `s`.`reason` = 'DAMAGE'
	AND (
		`ra`.`rental_id` <> `s`.`rental_id`
		OR `di`.`status` <> 'COMPLETED'
		OR `di`.`admin_decision` <> 'DAMAGED'
		OR `di`.`admin_decision` IS NULL
		OR `di`.`reviewed_by` IS NULL
		OR `di`.`reviewed_at` IS NULL
	)
LIMIT 1;

INSERT INTO `_v14_cross_flow_empty_guard` (`must_be_zero`)
SELECT 1
FROM `settlement`
WHERE (
		`status` = 'PENDING'
		AND `paid_at` IS NOT NULL
	)
	OR (
		`status` = 'CANCELLED'
		AND (`paid_amount` <> 0 OR `paid_at` IS NOT NULL)
	)
LIMIT 1;

INSERT INTO `_v14_cross_flow_empty_guard` (`must_be_zero`)
SELECT 1
FROM `settlement` AS `s`
LEFT JOIN (
	SELECT
		`settlement_id`,
		SUM(`amount`) AS `succeeded_amount`
	FROM `payment_attempt`
	WHERE `status` = 'SUCCEEDED'
	GROUP BY `settlement_id`
) AS `p`
	ON `p`.`settlement_id` = `s`.`settlement_id`
WHERE `s`.`paid_amount` <> COALESCE(`p`.`succeeded_amount`, 0)
LIMIT 1;

DROP TEMPORARY TABLE `_v14_cross_flow_empty_guard`;

ALTER TABLE `user_account`
	DROP CHECK `CK_USER_ACCOUNT_LOGIN_ID_EMAIL`;

ALTER TABLE `user_account`
	ADD CONSTRAINT `CK_USER_ACCOUNT_LOGIN_ID_EMAIL`
		CHECK (
			CHAR_LENGTH(`login_id`) BETWEEN 3 AND 254
			AND CAST(`login_id` AS BINARY)
				= CAST(LOWER(TRIM(`login_id`)) AS BINARY)
			AND REGEXP_LIKE(
				`login_id`,
				'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$',
				'c'
			)
		);

ALTER TABLE `damage_inspection`
	DROP CHECK `CK_DAMAGE_INSPECTION_AI_OUTPUT_STATE`;

ALTER TABLE `damage_inspection`
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_AI_OUTPUT_STATE`
		CHECK (
			(
				`status` = 'REQUESTED'
				AND `ai_result` IS NULL
				AND `confidence` IS NULL
				AND `model_version` IS NULL
			)
			OR (
				`status` = 'COMPLETED'
				AND `ai_result` IS NOT NULL
				AND `ai_result` IN ('NORMAL', 'DAMAGED', 'UNCERTAIN')
				AND `confidence` IS NOT NULL
				AND `model_version` IS NOT NULL
				AND CHAR_LENGTH(TRIM(`model_version`)) BETWEEN 1 AND 100
			)
			OR (
				`status` = 'FAILED'
				AND `ai_result` IS NULL
				AND `confidence` IS NULL
				AND (
					`model_version` IS NULL
					OR CHAR_LENGTH(TRIM(`model_version`)) BETWEEN 1 AND 100
				)
			)
		);

ALTER TABLE `payment_attempt`
	DROP CHECK `CK_PAYMENT_PROVIDER_STATUS_MAPPING`;

ALTER TABLE `payment_attempt`
	ADD CONSTRAINT `CK_PAYMENT_PROVIDER_STATUS_MAPPING`
		CHECK (
			(
				`provider` = 'MOCK'
				AND `toss_status` IS NULL
				AND `status` <> 'RECONCILIATION_REQUIRED'
			)
			OR (
				`provider` = 'TOSS_SANDBOX'
				AND (
					(
						`status` = 'REQUESTED'
						AND `toss_status` IS NULL
					)
					OR (
						`status` = 'PROCESSING'
						AND `toss_status` IS NOT NULL
						AND CAST(`toss_status` AS BINARY) IN (
							'READY',
							'IN_PROGRESS',
							'WAITING_FOR_DEPOSIT'
						)
					)
					OR (
						`status` = 'SUCCEEDED'
						AND `toss_status` IS NOT NULL
						AND CAST(`toss_status` AS BINARY) = 'DONE'
					)
					OR (
						`status` = 'FAILED'
						AND (
							`toss_status` IS NULL
							OR CAST(`toss_status` AS BINARY)
								IN ('ABORTED', 'EXPIRED')
						)
					)
					OR (
						`status` = 'CANCELLED'
						AND (
							`toss_status` IS NULL
							OR CAST(`toss_status` AS BINARY) = 'CANCELED'
						)
					)
					OR (
						`status` = 'RECONCILIATION_REQUIRED'
						AND `toss_status` IS NOT NULL
						AND CHAR_LENGTH(TRIM(`toss_status`)) BETWEEN 1 AND 50
						AND OCTET_LENGTH(`toss_status`)
							= OCTET_LENGTH(TRIM(`toss_status`))
					)
				)
			)
		);

-- A single generated claim spans open, recovery, and completed return states.
-- FAILED attempts release the claim and remain retryable history.
ALTER TABLE `return_attempt`
	DROP INDEX `UK_RETURN_ATTEMPT_OPEN_RENTAL_GUARD`,
	DROP INDEX `UK_RETURN_ATTEMPT_COMPLETED_RENTAL_GUARD`,
	DROP COLUMN `open_rental_guard`,
	DROP COLUMN `completed_rental_guard`,
	ADD COLUMN `claimed_rental_guard` CHAR(36)
		GENERATED ALWAYS AS (
			CASE
				WHEN `status` IN (
					'PROCESSING',
					'PHYSICAL_DONE',
					'RECOVERY_REQUIRED',
					'COMPLETED'
				)
					THEN `rental_id`
				ELSE NULL
			END
		) STORED
		AFTER `updated_at`,
	ADD CONSTRAINT `UK_RETURN_ATTEMPT_CLAIMED_RENTAL_GUARD`
		UNIQUE (`claimed_rental_guard`),
	ADD CONSTRAINT `UK_RETURN_ATTEMPT_ID_RENTAL_ID`
		UNIQUE (`return_attempt_id`, `rental_id`);

-- Project the authoritative rental onto DAMAGE_INSPECTION and bind the
-- projection back to RETURN_ATTEMPT with a composite FK.
ALTER TABLE `damage_inspection`
	ADD COLUMN `rental_id` CHAR(36) NULL
		AFTER `return_attempt_id`;

UPDATE `damage_inspection` AS `di`
JOIN `return_attempt` AS `ra`
	ON `ra`.`return_attempt_id` = `di`.`return_attempt_id`
SET `di`.`rental_id` = `ra`.`rental_id`;

ALTER TABLE `damage_inspection`
	DROP FOREIGN KEY `FK_DAMAGE_INSPECTION_RETURN_ATTEMPT`,
	MODIFY COLUMN `rental_id` CHAR(36) NOT NULL,
	ADD COLUMN `settlement_eligible_guard` TINYINT
		GENERATED ALWAYS AS (
			CASE
				WHEN `status` = 'COMPLETED'
					AND `admin_decision` = 'DAMAGED'
					AND `reviewed_by` IS NOT NULL
					AND `reviewed_at` IS NOT NULL
					THEN 1
				ELSE NULL
			END
		) STORED
		AFTER `updated_at`,
	ADD CONSTRAINT `UK_DAMAGE_INSPECTION_RENTAL_ELIGIBLE`
		UNIQUE (
			`inspection_id`,
			`rental_id`,
			`settlement_eligible_guard`
		),
	ADD CONSTRAINT `FK_DAMAGE_INSPECTION_RETURN_ATTEMPT_RENTAL`
		FOREIGN KEY (`return_attempt_id`, `rental_id`)
		REFERENCES `return_attempt` (`return_attempt_id`, `rental_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;

-- The generated value is 1 only for DAMAGE settlements. The composite FK
-- therefore verifies rental ownership and reviewed-DAMAGED eligibility in one
-- referential constraint. Later edits that invalidate the evidence are also
-- rejected by ON UPDATE RESTRICT.
ALTER TABLE `settlement`
	DROP FOREIGN KEY `FK_SETTLEMENT_DAMAGE_INSPECTION`;

ALTER TABLE `settlement`
	ADD COLUMN `damage_basis_guard` TINYINT
		GENERATED ALWAYS AS (
			CASE
				WHEN `reason` = 'DAMAGE'
					AND `damage_inspection_id` IS NOT NULL
					THEN 1
				ELSE NULL
			END
		) STORED
		AFTER `updated_at`,
	ADD CONSTRAINT `FK_SETTLEMENT_DAMAGE_INSPECTION`
		FOREIGN KEY (
			`damage_inspection_id`,
			`rental_id`,
			`damage_basis_guard`
		)
		REFERENCES `damage_inspection` (
			`inspection_id`,
			`rental_id`,
			`settlement_eligible_guard`
		)
		ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE `settlement`
	DROP CHECK `CK_SETTLEMENT_PAYMENT_STATE`;

ALTER TABLE `settlement`
	ADD CONSTRAINT `CK_SETTLEMENT_PAYMENT_STATE`
		CHECK (
			(
				`status` = 'PAID'
				AND `paid_amount` = `amount`
				AND `paid_at` IS NOT NULL
			)
			OR (
				`status` = 'PENDING'
				AND `paid_amount` < `amount`
				AND `paid_at` IS NULL
			)
			OR (
				`status` = 'CANCELLED'
				AND `paid_amount` = 0
				AND `paid_at` IS NULL
			)
		);

DELIMITER $$

CREATE TRIGGER `TRG_RETURN_ATTEMPT_BEFORE_INSERT`
BEFORE INSERT ON `return_attempt`
FOR EACH ROW
BEGIN
	DECLARE `rental_status_value` VARCHAR(30) DEFAULT NULL;
	DECLARE CONTINUE HANDLER FOR NOT FOUND
		SET `rental_status_value` = NULL;

	IF `NEW`.`status` <> 'FAILED' THEN
		SELECT `status`
		INTO `rental_status_value`
		FROM `rental`
		WHERE `rental_id` = `NEW`.`rental_id`
		FOR UPDATE;

		IF `rental_status_value` <> 'RETURNING'
			OR `rental_status_value` IS NULL THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'RETURN_RENTAL_NOT_RETURNING';
		END IF;
	END IF;

	IF `NEW`.`status` = 'COMPLETED' THEN
		UPDATE `rental`
		SET
			`status` = 'COMPLETED',
			`ended_at` = `NEW`.`completed_at`
		WHERE `rental_id` = `NEW`.`rental_id`
			AND `status` = 'RETURNING';

		IF ROW_COUNT() <> 1 THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'RETURN_RENTAL_COMPLETION_CONFLICT';
		END IF;
	END IF;
END$$

CREATE TRIGGER `TRG_RETURN_ATTEMPT_BEFORE_UPDATE`
BEFORE UPDATE ON `return_attempt`
FOR EACH ROW
BEGIN
	DECLARE `rental_status_value` VARCHAR(30) DEFAULT NULL;
	DECLARE CONTINUE HANDLER FOR NOT FOUND
		SET `rental_status_value` = NULL;

	IF `NEW`.`rental_id` <> `OLD`.`rental_id` THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'RETURN_RENTAL_IMMUTABLE';
	END IF;

	IF `OLD`.`status` = 'COMPLETED'
		AND (
			`NEW`.`status` <> 'COMPLETED'
			OR NOT (`NEW`.`completed_at` <=> `OLD`.`completed_at`)
			OR NOT (
				`NEW`.`physical_completed_at`
					<=> `OLD`.`physical_completed_at`
			)
			OR NOT (`NEW`.`return_slot_id` <=> `OLD`.`return_slot_id`)
		) THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'COMPLETED_RETURN_IS_TERMINAL';
	END IF;

	IF `OLD`.`status` <> 'COMPLETED'
		AND `NEW`.`status` <> 'FAILED' THEN
		SELECT `status`
		INTO `rental_status_value`
		FROM `rental`
		WHERE `rental_id` = `NEW`.`rental_id`
		FOR UPDATE;

		IF `rental_status_value` <> 'RETURNING'
			OR `rental_status_value` IS NULL THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'RETURN_RENTAL_NOT_RETURNING';
		END IF;
	END IF;

	IF `OLD`.`status` <> 'COMPLETED'
		AND `NEW`.`status` = 'COMPLETED' THEN
		UPDATE `rental`
		SET
			`status` = 'COMPLETED',
			`ended_at` = `NEW`.`completed_at`
		WHERE `rental_id` = `NEW`.`rental_id`
			AND `status` = 'RETURNING';

		IF ROW_COUNT() <> 1 THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'RETURN_RENTAL_COMPLETION_CONFLICT';
		END IF;
	END IF;
END$$

CREATE TRIGGER `TRG_PAYMENT_ATTEMPT_CREDIT_INSERT`
BEFORE INSERT ON `payment_attempt`
FOR EACH ROW
BEGIN
	IF `NEW`.`status` = 'SUCCEEDED' THEN
		IF `NEW`.`approved_at` IS NULL
			OR `NEW`.`completed_at` IS NULL THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'SUCCEEDED_PAYMENT_REQUIRES_TERMINAL_TIMES';
		END IF;

		UPDATE `settlement`
		SET
			`status` = CASE
				WHEN `paid_amount` + `NEW`.`amount` = `amount`
					THEN 'PAID'
				ELSE 'PENDING'
			END,
			`paid_at` = CASE
				WHEN `paid_amount` + `NEW`.`amount` = `amount`
					THEN `NEW`.`approved_at`
				ELSE NULL
			END,
			`paid_amount` = `paid_amount` + `NEW`.`amount`
		WHERE `settlement_id` = `NEW`.`settlement_id`
			AND `status` = 'PENDING'
			AND `paid_amount` + `NEW`.`amount` <= `amount`;

		IF ROW_COUNT() <> 1 THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE';
		END IF;
	END IF;
END$$

CREATE TRIGGER `TRG_PAYMENT_ATTEMPT_CREDIT_UPDATE`
BEFORE UPDATE ON `payment_attempt`
FOR EACH ROW
BEGIN
	IF `NEW`.`settlement_id` <> `OLD`.`settlement_id`
		OR `NEW`.`amount` <> `OLD`.`amount` THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'PAYMENT_ALLOCATION_IMMUTABLE';
	END IF;

	IF `OLD`.`status` = 'SUCCEEDED'
		AND (
			`NEW`.`status` <> 'SUCCEEDED'
			OR NOT (`NEW`.`approved_at` <=> `OLD`.`approved_at`)
			OR NOT (`NEW`.`completed_at` <=> `OLD`.`completed_at`)
		) THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'SUCCEEDED_PAYMENT_IS_TERMINAL';
	END IF;

	IF `OLD`.`status` <> 'SUCCEEDED'
		AND `NEW`.`status` = 'SUCCEEDED' THEN
		IF `NEW`.`approved_at` IS NULL
			OR `NEW`.`completed_at` IS NULL THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'SUCCEEDED_PAYMENT_REQUIRES_TERMINAL_TIMES';
		END IF;

		UPDATE `settlement`
		SET
			`status` = CASE
				WHEN `paid_amount` + `NEW`.`amount` = `amount`
					THEN 'PAID'
				ELSE 'PENDING'
			END,
			`paid_at` = CASE
				WHEN `paid_amount` + `NEW`.`amount` = `amount`
					THEN `NEW`.`approved_at`
				ELSE NULL
			END,
			`paid_amount` = `paid_amount` + `NEW`.`amount`
		WHERE `settlement_id` = `NEW`.`settlement_id`
			AND `status` = 'PENDING'
			AND `paid_amount` + `NEW`.`amount` <= `amount`;

		IF ROW_COUNT() <> 1 THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE';
		END IF;
	END IF;
END$$

DELIMITER ;
