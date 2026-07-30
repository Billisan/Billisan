-- P0-5 Option 2: authoritative return-slot semantics.
--
-- RETURN_ATTEMPT.return_slot_id is assigned only by Spring after Inspection.
-- It is NULL before slot allocation and is mandatory once physical return has
-- completed. Client-supplied slot selection is not part of the create contract.

-- V2 created the FK against the old, ambiguous target_slot_id name.
ALTER TABLE `return_attempt`
	DROP FOREIGN KEY `FK_RETURN_ATTEMPT_TARGET_SLOT`;

ALTER TABLE `return_attempt`
	CHANGE COLUMN `target_slot_id` `return_slot_id` CHAR(36) NULL;

-- A return slot can be held by at most one non-terminal attempt. COMPLETED and
-- FAILED rows are historical and must not block future reuse of the same slot.
-- A non-NULL RECOVERY_REQUIRED row continues to hold the slot until an explicit
-- reconciliation decision releases or completes it.
ALTER TABLE `return_attempt`
	ADD COLUMN `assigned_return_slot_guard` CHAR(36)
		GENERATED ALWAYS AS (
			CASE
				WHEN `return_slot_id` IS NOT NULL
					AND `status` IN ('PROCESSING', 'PHYSICAL_DONE', 'RECOVERY_REQUIRED')
				THEN `return_slot_id`
				ELSE NULL
			END
		) STORED,
	ADD CONSTRAINT `UK_RETURN_ATTEMPT_ASSIGNED_SLOT_GUARD`
		UNIQUE (`assigned_return_slot_guard`),
	ADD CONSTRAINT `CK_RETURN_ATTEMPT_REQUIRED_RETURN_SLOT`
		CHECK (
			`status` NOT IN ('PHYSICAL_DONE', 'COMPLETED')
			OR `return_slot_id` IS NOT NULL
		),
	ADD CONSTRAINT `FK_RETURN_ATTEMPT_RETURN_SLOT`
		FOREIGN KEY (`return_slot_id`) REFERENCES `slot` (`slot_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;
