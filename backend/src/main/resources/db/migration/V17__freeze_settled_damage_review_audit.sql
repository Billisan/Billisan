-- P2 settled damage-review audit immutability:
-- settlement_eligible_guard proves only that a completed DAMAGED review has
-- non-null audit fields. Its value remains 1 when reviewed_by or reviewed_at
-- is replaced, so the composite settlement FK cannot detect that rewrite.
--
-- Freeze the complete approval-audit tuple after a DAMAGE settlement starts
-- referencing the inspection. The locking read is a current read and also
-- serializes this update with concurrent settlement creation.

DELIMITER $$

CREATE TRIGGER `TRG_DAMAGE_INSPECTION_REVIEW_AUDIT_BEFORE_UPDATE`
BEFORE UPDATE ON `damage_inspection`
FOR EACH ROW
BEGIN
	DECLARE `referencing_settlement_id` CHAR(36) DEFAULT NULL;
	DECLARE CONTINUE HANDLER FOR NOT FOUND
		SET `referencing_settlement_id` = NULL;

	IF NOT (`NEW`.`admin_decision` <=> `OLD`.`admin_decision`)
		OR NOT (`NEW`.`reviewed_by` <=> `OLD`.`reviewed_by`)
		OR NOT (`NEW`.`reviewed_at` <=> `OLD`.`reviewed_at`) THEN
		SELECT `settlement_id`
		INTO `referencing_settlement_id`
		FROM `settlement`
		WHERE `damage_inspection_id` = `OLD`.`inspection_id`
		LIMIT 1
		FOR UPDATE;

		IF `referencing_settlement_id` IS NOT NULL THEN
			SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT =
					'SETTLED_DAMAGE_REVIEW_AUDIT_IMMUTABLE';
		END IF;
	END IF;
END$$

DELIMITER ;
