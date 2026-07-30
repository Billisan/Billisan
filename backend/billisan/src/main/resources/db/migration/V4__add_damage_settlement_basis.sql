-- P0-6 Option 1: direct and immutable damage-settlement basis.
--
-- A DAMAGE settlement must identify the exact administrator-reviewed
-- DAMAGE_INSPECTION that caused the cumulative settlement row to be created
-- or upgraded. OVERDUE, LOSS, and ADJUSTMENT do not carry this reference.
--
-- Cross-row facts (inspection.admin_decision = DAMAGED and the inspection's
-- return attempt belonging to the same rental) are verified while Spring holds
-- all affected rows in one transaction. MySQL CHECK cannot contain subqueries.

ALTER TABLE `settlement`
	ADD COLUMN `damage_inspection_id` CHAR(36) NULL
		COMMENT 'Administrator-reviewed DAMAGE_INSPECTION used as DAMAGE settlement basis'
		AFTER `rental_id`;

-- One cumulative settlement row exists per rental, and one administrator
-- inspection cannot create financial liability more than once.
ALTER TABLE `settlement`
	ADD CONSTRAINT `UK_SETTLEMENT_RENTAL_ID`
		UNIQUE (`rental_id`),
	ADD CONSTRAINT `UK_SETTLEMENT_DAMAGE_INSPECTION_ID`
		UNIQUE (`damage_inspection_id`),
	ADD CONSTRAINT `CK_SETTLEMENT_DAMAGE_BASIS`
		CHECK (
			(
				`reason` = 'DAMAGE'
				AND `damage_inspection_id` IS NOT NULL
			)
			OR
			(
				`reason` <> 'DAMAGE'
				AND `damage_inspection_id` IS NULL
			)
		),
	ADD CONSTRAINT `FK_SETTLEMENT_DAMAGE_INSPECTION`
		FOREIGN KEY (`damage_inspection_id`)
		REFERENCES `damage_inspection` (`inspection_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;
