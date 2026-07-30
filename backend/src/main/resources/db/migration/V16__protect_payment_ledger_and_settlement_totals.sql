-- P1 payment-ledger integrity hardening:
-- 1. A successful PAYMENT_ATTEMPT is immutable history and cannot be deleted.
-- 2. New SETTLEMENT rows must start without credited money.
-- 3. SETTLEMENT.paid_amount can change only through a successful-payment
--    trigger. Direct rewrites of the derived status/paid_at tuple are rejected,
--    except for an unpaid cancellation or a paid settlement repriced upward
--    into a partially paid settlement.
--
-- The internal guard is a transaction-scoped, one-use handshake between the
-- PAYMENT_ATTEMPT trigger and the SETTLEMENT trigger. Application accounts
-- must not receive direct DML privileges on this table or schema DDL
-- privileges that could bypass row triggers with TRUNCATE/DROP.

-- MySQL DDL is not transactionally rolled back. Verify the existing
-- materialized total before creating permanent objects or replacing triggers.
CREATE TEMPORARY TABLE `_v16_payment_ledger_empty_guard` (
	`must_be_zero` TINYINT NOT NULL,
	CONSTRAINT `CK_V16_PAYMENT_LEDGER_EMPTY_GUARD`
		CHECK (`must_be_zero` = 0)
);

INSERT INTO `_v16_payment_ledger_empty_guard` (`must_be_zero`)
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

DROP TEMPORARY TABLE `_v16_payment_ledger_empty_guard`;

CREATE TABLE `settlement_payment_mutation_guard` (
	`connection_id` BIGINT UNSIGNED NOT NULL,
	`settlement_id` CHAR(36) NOT NULL,
	`expected_paid_amount` BIGINT UNSIGNED NOT NULL,
	`expected_status` VARCHAR(30) NOT NULL,
	`expected_paid_at` DATETIME(6) NULL,
	`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `PK_SETTLEMENT_PAYMENT_MUTATION_GUARD`
		PRIMARY KEY (`connection_id`),
	CONSTRAINT `CK_SETTLEMENT_PAYMENT_MUTATION_GUARD_STATUS`
		CHECK (`expected_status` IN ('PENDING', 'PAID'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Internal one-use trigger handshake; no application DML grants';

DROP TRIGGER `TRG_PAYMENT_ATTEMPT_CREDIT_INSERT`;
DROP TRIGGER `TRG_PAYMENT_ATTEMPT_CREDIT_UPDATE`;

DELIMITER $$

CREATE TRIGGER `TRG_SETTLEMENT_BEFORE_INSERT`
BEFORE INSERT ON `settlement`
FOR EACH ROW
BEGIN
	IF `NEW`.`paid_amount` <> 0
		OR `NEW`.`paid_at` IS NOT NULL
		OR `NEW`.`status` = 'PAID' THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'SETTLEMENT_MUST_START_WITHOUT_CREDIT';
	END IF;
END$$

CREATE TRIGGER `TRG_SETTLEMENT_PAYMENT_BEFORE_UPDATE`
BEFORE UPDATE ON `settlement`
FOR EACH ROW
BEGIN
	DECLARE `guard_consumed` INT DEFAULT 0;
	DECLARE `allowed_unpaid_cancel` BOOLEAN DEFAULT FALSE;
	DECLARE `allowed_upward_reprice` BOOLEAN DEFAULT FALSE;

	SET `allowed_unpaid_cancel` = (
		`OLD`.`status` = 'PENDING'
		AND `NEW`.`status` = 'CANCELLED'
		AND `OLD`.`paid_amount` = 0
		AND `NEW`.`paid_amount` = 0
		AND `OLD`.`paid_at` IS NULL
		AND `NEW`.`paid_at` IS NULL
	);

	SET `allowed_upward_reprice` = (
		`OLD`.`status` = 'PAID'
		AND `NEW`.`status` = 'PENDING'
		AND `OLD`.`paid_amount` = `NEW`.`paid_amount`
		AND `NEW`.`amount` > `OLD`.`amount`
		AND `NEW`.`paid_amount` < `NEW`.`amount`
		AND `OLD`.`paid_at` IS NOT NULL
		AND `NEW`.`paid_at` IS NULL
	);

	IF `NEW`.`paid_amount` <> `OLD`.`paid_amount` THEN
		DELETE FROM `settlement_payment_mutation_guard`
		WHERE `connection_id` = CONNECTION_ID()
			AND `settlement_id` = `OLD`.`settlement_id`
			AND `expected_paid_amount` = `NEW`.`paid_amount`
			AND `expected_status` = `NEW`.`status`
			AND `expected_paid_at` <=> `NEW`.`paid_at`;

		SET `guard_consumed` = ROW_COUNT();

		IF `guard_consumed` <> 1 THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'SETTLEMENT_PAYMENT_FIELDS_MANAGED';
		END IF;
	ELSEIF `NEW`.`status` <> `OLD`.`status`
		OR NOT (`NEW`.`paid_at` <=> `OLD`.`paid_at`) THEN
		IF NOT `allowed_unpaid_cancel`
			AND NOT `allowed_upward_reprice` THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'SETTLEMENT_PAYMENT_FIELDS_MANAGED';
		END IF;
	END IF;
END$$

CREATE TRIGGER `TRG_PAYMENT_ATTEMPT_CREDIT_INSERT`
BEFORE INSERT ON `payment_attempt`
FOR EACH ROW
BEGIN
	DECLARE `settlement_amount_value` BIGINT UNSIGNED DEFAULT NULL;
	DECLARE `settlement_paid_amount_value` BIGINT UNSIGNED DEFAULT NULL;
	DECLARE `settlement_status_value` VARCHAR(30) DEFAULT NULL;
	DECLARE `next_paid_amount_value` BIGINT UNSIGNED DEFAULT NULL;
	DECLARE `next_status_value` VARCHAR(30) DEFAULT NULL;
	DECLARE `next_paid_at_value` DATETIME(6) DEFAULT NULL;
	DECLARE CONTINUE HANDLER FOR NOT FOUND
		SET `settlement_amount_value` = NULL;

	IF `NEW`.`status` = 'SUCCEEDED' THEN
		IF `NEW`.`approved_at` IS NULL
			OR `NEW`.`completed_at` IS NULL THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'SUCCEEDED_PAYMENT_REQUIRES_TERMINAL_TIMES';
		END IF;

		SELECT `amount`, `paid_amount`, `status`
		INTO
			`settlement_amount_value`,
			`settlement_paid_amount_value`,
			`settlement_status_value`
		FROM `settlement`
		WHERE `settlement_id` = `NEW`.`settlement_id`
		FOR UPDATE;

		IF `settlement_amount_value` IS NULL
			OR `settlement_status_value` <> 'PENDING'
			OR `settlement_paid_amount_value` + `NEW`.`amount`
				> `settlement_amount_value` THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE';
		END IF;

		SET `next_paid_amount_value` =
			`settlement_paid_amount_value` + `NEW`.`amount`;
		SET `next_status_value` = CASE
			WHEN `next_paid_amount_value` = `settlement_amount_value`
				THEN 'PAID'
			ELSE 'PENDING'
		END;
		SET `next_paid_at_value` = CASE
			WHEN `next_status_value` = 'PAID' THEN `NEW`.`approved_at`
			ELSE NULL
		END;

		INSERT INTO `settlement_payment_mutation_guard` (
			`connection_id`,
			`settlement_id`,
			`expected_paid_amount`,
			`expected_status`,
			`expected_paid_at`
		) VALUES (
			CONNECTION_ID(),
			`NEW`.`settlement_id`,
			`next_paid_amount_value`,
			`next_status_value`,
			`next_paid_at_value`
		);

		UPDATE `settlement`
		SET
			`paid_amount` = `next_paid_amount_value`,
			`status` = `next_status_value`,
			`paid_at` = `next_paid_at_value`
		WHERE `settlement_id` = `NEW`.`settlement_id`;

		IF ROW_COUNT() <> 1 THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'PAYMENT_SETTLEMENT_UPDATE_CONFLICT';
		END IF;
	END IF;
END$$

CREATE TRIGGER `TRG_PAYMENT_ATTEMPT_CREDIT_UPDATE`
BEFORE UPDATE ON `payment_attempt`
FOR EACH ROW
BEGIN
	DECLARE `settlement_amount_value` BIGINT UNSIGNED DEFAULT NULL;
	DECLARE `settlement_paid_amount_value` BIGINT UNSIGNED DEFAULT NULL;
	DECLARE `settlement_status_value` VARCHAR(30) DEFAULT NULL;
	DECLARE `next_paid_amount_value` BIGINT UNSIGNED DEFAULT NULL;
	DECLARE `next_status_value` VARCHAR(30) DEFAULT NULL;
	DECLARE `next_paid_at_value` DATETIME(6) DEFAULT NULL;
	DECLARE CONTINUE HANDLER FOR NOT FOUND
		SET `settlement_amount_value` = NULL;

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

		SELECT `amount`, `paid_amount`, `status`
		INTO
			`settlement_amount_value`,
			`settlement_paid_amount_value`,
			`settlement_status_value`
		FROM `settlement`
		WHERE `settlement_id` = `NEW`.`settlement_id`
		FOR UPDATE;

		IF `settlement_amount_value` IS NULL
			OR `settlement_status_value` <> 'PENDING'
			OR `settlement_paid_amount_value` + `NEW`.`amount`
				> `settlement_amount_value` THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE';
		END IF;

		SET `next_paid_amount_value` =
			`settlement_paid_amount_value` + `NEW`.`amount`;
		SET `next_status_value` = CASE
			WHEN `next_paid_amount_value` = `settlement_amount_value`
				THEN 'PAID'
			ELSE 'PENDING'
		END;
		SET `next_paid_at_value` = CASE
			WHEN `next_status_value` = 'PAID' THEN `NEW`.`approved_at`
			ELSE NULL
		END;

		INSERT INTO `settlement_payment_mutation_guard` (
			`connection_id`,
			`settlement_id`,
			`expected_paid_amount`,
			`expected_status`,
			`expected_paid_at`
		) VALUES (
			CONNECTION_ID(),
			`NEW`.`settlement_id`,
			`next_paid_amount_value`,
			`next_status_value`,
			`next_paid_at_value`
		);

		UPDATE `settlement`
		SET
			`paid_amount` = `next_paid_amount_value`,
			`status` = `next_status_value`,
			`paid_at` = `next_paid_at_value`
		WHERE `settlement_id` = `NEW`.`settlement_id`;

		IF ROW_COUNT() <> 1 THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = 'PAYMENT_SETTLEMENT_UPDATE_CONFLICT';
		END IF;
	END IF;
END$$

CREATE TRIGGER `TRG_PAYMENT_ATTEMPT_BEFORE_DELETE`
BEFORE DELETE ON `payment_attempt`
FOR EACH ROW
BEGIN
	IF `OLD`.`status` = 'SUCCEEDED' THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'SUCCEEDED_PAYMENT_DELETE_FORBIDDEN';
	END IF;
END$$

DELIMITER ;
