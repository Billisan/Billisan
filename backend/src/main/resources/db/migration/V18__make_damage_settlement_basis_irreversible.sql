-- P2 settled damage-review audit history:
-- V17 freezes the approval tuple while a settlement currently references the
-- inspection. Without an irreversible settlement basis, an application could
-- first reclassify DAMAGE to a non-damage reason and clear the inspection, then
-- rewrite the formerly settled approval tuple.
--
-- Preserve the supported cumulative OVERDUE -> DAMAGE upgrade (OLD basis is
-- null), but once a DAMAGE basis exists, prevent unlinking, swapping, or
-- reclassifying it. Also retain the settlement row so the V17 current-reference
-- lookup remains a permanent historical guard.

DELIMITER $$

DROP TRIGGER `TRG_SETTLEMENT_PAYMENT_BEFORE_UPDATE`$$

CREATE TRIGGER `TRG_SETTLEMENT_PAYMENT_BEFORE_UPDATE`
BEFORE UPDATE ON `settlement`
FOR EACH ROW
BEGIN
	DECLARE `guard_consumed` INT DEFAULT 0;
	DECLARE `allowed_unpaid_cancel` BOOLEAN DEFAULT FALSE;
	DECLARE `allowed_upward_reprice` BOOLEAN DEFAULT FALSE;

	IF `OLD`.`damage_inspection_id` IS NOT NULL
		AND (
			`NEW`.`reason` <> `OLD`.`reason`
			OR NOT (
				`NEW`.`damage_inspection_id`
					<=> `OLD`.`damage_inspection_id`
			)
		) THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'DAMAGE_SETTLEMENT_BASIS_IMMUTABLE';
	END IF;

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

CREATE TRIGGER `TRG_SETTLEMENT_DAMAGE_BASIS_BEFORE_DELETE`
BEFORE DELETE ON `settlement`
FOR EACH ROW
BEGIN
	IF `OLD`.`damage_inspection_id` IS NOT NULL THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'DAMAGE_SETTLEMENT_DELETE_FORBIDDEN';
	END IF;
END$$

DELIMITER ;
