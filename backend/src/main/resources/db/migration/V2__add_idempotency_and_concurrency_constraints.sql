-- P0-4: database-enforced idempotency, concurrency, and referential integrity.
-- Target: MySQL 8.0.16+ (CHECK constraints must be enforced).

-- Natural and protocol idempotency keys.
ALTER TABLE `user_account`
	ADD CONSTRAINT `UK_USER_ACCOUNT_LOGIN_ID` UNIQUE (`login_id`);

ALTER TABLE `face_profile_sync_operation`
	ADD CONSTRAINT `UK_FACE_PROFILE_SYNC_REQUEST_ID` UNIQUE (`request_id`);

ALTER TABLE `slot`
	ADD CONSTRAINT `UK_SLOT_STATION_NUMBER` UNIQUE (`station_id`, `slot_number`),
	ADD CONSTRAINT `UK_SLOT_ID_STATION_ID` UNIQUE (`slot_id`, `station_id`);

ALTER TABLE `rental`
	ADD CONSTRAINT `UK_RENTAL_REQUEST_ID` UNIQUE (`rental_request_id`),
	ADD CONSTRAINT `UK_RENTAL_ID_USER_ID` UNIQUE (`rental_id`, `user_id`);

ALTER TABLE `return_attempt`
	ADD CONSTRAINT `UK_RETURN_ATTEMPT_REQUEST_ID` UNIQUE (`request_id`);

ALTER TABLE `damage_inspection`
	ADD CONSTRAINT `UK_DAMAGE_INSPECTION_REQUEST_ID` UNIQUE (`request_id`),
	ADD CONSTRAINT `UK_DAMAGE_INSPECTION_RETURN_ATTEMPT_ID` UNIQUE (`return_attempt_id`);

ALTER TABLE `payment_attempt`
	ADD CONSTRAINT `UK_PAYMENT_CREATION_REQUEST_ID` UNIQUE (`creation_request_id`),
	ADD CONSTRAINT `UK_PAYMENT_TOSS_ORDER_ID` UNIQUE (`toss_order_id`),
	ADD CONSTRAINT `UK_PAYMENT_TOSS_PAYMENT_KEY` UNIQUE (`toss_payment_key`);

ALTER TABLE `device_operation`
	ADD CONSTRAINT `UK_DEVICE_OPERATION_COMMAND_ID` UNIQUE (`command_id`),
	ADD CONSTRAINT `UK_DEVICE_OPERATION_EVENT_ID` UNIQUE (`event_id`);

-- Only one open rental per user. LOST/COMPLETED/CANCELLED/FAILED are terminal.
-- The requested-slot guard protects concurrent checkout selection only.
-- It is released after REQUESTED because the anonymous inventory unit may later
-- be replenished and rented again while an earlier rental remains ACTIVE.
ALTER TABLE `rental`
	ADD COLUMN `active_user_guard` CHAR(36)
		GENERATED ALWAYS AS (
			CASE
				WHEN `status` IN ('REQUESTED', 'ACTIVE', 'RETURNING') THEN `user_id`
				ELSE NULL
			END
		) STORED,
	ADD COLUMN `requested_slot_guard` CHAR(36)
		GENERATED ALWAYS AS (
			CASE
				WHEN `status` = 'REQUESTED' THEN `checkout_slot_id`
				ELSE NULL
			END
		) STORED,
	ADD CONSTRAINT `UK_RENTAL_ACTIVE_USER_GUARD` UNIQUE (`active_user_guard`),
	ADD CONSTRAINT `UK_RENTAL_REQUESTED_SLOT_GUARD` UNIQUE (`requested_slot_guard`);

-- Failed attempts can be retried, but only one open attempt and one completed
-- attempt may exist for a rental at any point.
ALTER TABLE `return_attempt`
	ADD COLUMN `open_rental_guard` CHAR(36)
		GENERATED ALWAYS AS (
			CASE
				WHEN `status` IN ('PROCESSING', 'PHYSICAL_DONE', 'RECOVERY_REQUIRED') THEN `rental_id`
				ELSE NULL
			END
		) STORED,
	ADD COLUMN `completed_rental_guard` CHAR(36)
		GENERATED ALWAYS AS (
			CASE
				WHEN `status` = 'COMPLETED' THEN `rental_id`
				ELSE NULL
			END
		) STORED,
	ADD CONSTRAINT `UK_RETURN_ATTEMPT_OPEN_RENTAL_GUARD` UNIQUE (`open_rental_guard`),
	ADD CONSTRAINT `UK_RETURN_ATTEMPT_COMPLETED_RENTAL_GUARD` UNIQUE (`completed_rental_guard`);

-- Status and value domains used by the guards and financial flow.
ALTER TABLE `face_profile_sync_operation`
	ADD CONSTRAINT `CK_FACE_PROFILE_SYNC_OPERATION_TYPE`
		CHECK (`operation_type` IN ('REGISTER', 'REREGISTER', 'DELETE')),
	ADD CONSTRAINT `CK_FACE_PROFILE_SYNC_STATUS`
		CHECK (`sync_status` IN ('REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'RECONCILIATION_REQUIRED'));

ALTER TABLE `rental`
	ADD CONSTRAINT `CK_RENTAL_STATUS`
		CHECK (`status` IN ('REQUESTED', 'ACTIVE', 'RETURNING', 'COMPLETED', 'LOST', 'CANCELLED', 'FAILED'));

ALTER TABLE `return_attempt`
	ADD CONSTRAINT `CK_RETURN_ATTEMPT_STATUS`
		CHECK (`status` IN ('PROCESSING', 'PHYSICAL_DONE', 'COMPLETED', 'RECOVERY_REQUIRED', 'FAILED'));

ALTER TABLE `damage_inspection`
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_STATUS`
		CHECK (`status` IN ('REQUESTED', 'COMPLETED', 'FAILED')),
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_AI_RESULT`
		CHECK (`ai_result` IS NULL OR `ai_result` IN ('NORMAL', 'DAMAGED', 'UNCERTAIN', 'FAILED')),
	ADD CONSTRAINT `CK_DAMAGE_INSPECTION_CONFIDENCE`
		CHECK (`confidence` IS NULL OR (`confidence` >= 0.0000 AND `confidence` <= 1.0000));

ALTER TABLE `settlement`
	ADD CONSTRAINT `CK_SETTLEMENT_REASON`
		CHECK (`reason` IN ('OVERDUE', 'LOSS', 'DAMAGE', 'ADJUSTMENT')),
	ADD CONSTRAINT `CK_SETTLEMENT_STATUS`
		CHECK (`status` IN ('PENDING', 'PAID', 'CANCELLED')),
	ADD CONSTRAINT `CK_SETTLEMENT_AMOUNT`
		CHECK (`amount` >= 0),
	ADD CONSTRAINT `CK_SETTLEMENT_PAID_AMOUNT`
		CHECK (`paid_amount` >= 0 AND `paid_amount` <= `amount`);

ALTER TABLE `payment_attempt`
	ADD CONSTRAINT `CK_PAYMENT_PROVIDER`
		CHECK (`provider` IN ('MOCK', 'TOSS_SANDBOX')),
	ADD CONSTRAINT `CK_PAYMENT_STATUS`
		CHECK (`status` IN ('REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
	ADD CONSTRAINT `CK_PAYMENT_AMOUNT`
		CHECK (`amount` >= 0);

ALTER TABLE `device_operation`
	ADD CONSTRAINT `CK_DEVICE_OPERATION_STATUS`
		CHECK (`status` IN ('REQUESTED', 'ACKED', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'OUTCOME_UNKNOWN')),
	ADD CONSTRAINT `CK_DEVICE_OPERATION_TERMINAL_EVENT_TYPE`
		CHECK (
			`terminal_event_type` IS NULL
			OR `terminal_event_type` IN ('OPERATION_COMPLETED', 'OPERATION_FAILED')
		);

-- Foreign keys are applied only after all tables and candidate keys exist.
ALTER TABLE `face_profile_sync_operation`
	ADD CONSTRAINT `FK_FACE_PROFILE_SYNC_USER`
		FOREIGN KEY (`user_id`) REFERENCES `user_account` (`user_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE `slot`
	ADD CONSTRAINT `FK_SLOT_STATION`
		FOREIGN KEY (`station_id`) REFERENCES `station` (`station_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE `rental`
	ADD CONSTRAINT `FK_RENTAL_USER`
		FOREIGN KEY (`user_id`) REFERENCES `user_account` (`user_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT,
	ADD CONSTRAINT `FK_RENTAL_CHECKOUT_SLOT`
		FOREIGN KEY (`checkout_slot_id`) REFERENCES `slot` (`slot_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE `return_attempt`
	ADD CONSTRAINT `FK_RETURN_ATTEMPT_RENTAL`
		FOREIGN KEY (`rental_id`) REFERENCES `rental` (`rental_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT,
	ADD CONSTRAINT `FK_RETURN_ATTEMPT_TARGET_SLOT`
		FOREIGN KEY (`target_slot_id`) REFERENCES `slot` (`slot_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE `damage_inspection`
	ADD CONSTRAINT `FK_DAMAGE_INSPECTION_RETURN_ATTEMPT`
		FOREIGN KEY (`return_attempt_id`) REFERENCES `return_attempt` (`return_attempt_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;

-- The composite FK prevents SETTLEMENT.user_id from disagreeing with RENTAL.user_id.
ALTER TABLE `settlement`
	ADD CONSTRAINT `FK_SETTLEMENT_RENTAL_USER`
		FOREIGN KEY (`rental_id`, `user_id`) REFERENCES `rental` (`rental_id`, `user_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE `payment_attempt`
	ADD CONSTRAINT `FK_PAYMENT_ATTEMPT_SETTLEMENT`
		FOREIGN KEY (`settlement_id`) REFERENCES `settlement` (`settlement_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE `device_operation`
	ADD CONSTRAINT `FK_DEVICE_OPERATION_STATION`
		FOREIGN KEY (`station_id`) REFERENCES `station` (`station_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT,
	ADD CONSTRAINT `FK_DEVICE_OPERATION_SLOT_STATION`
		FOREIGN KEY (`slot_id`, `station_id`) REFERENCES `slot` (`slot_id`, `station_id`)
		ON UPDATE RESTRICT ON DELETE RESTRICT;
