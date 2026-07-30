-- P1-6 follow-up: replace the deprecated unary BINARY expression stored in
-- CK_PAYMENT_PROVIDER_STATUS_MAPPING with CAST(... AS BINARY).
--
-- V11 is immutable because it has already been applied and validated. Editing
-- V11 would create a Flyway checksum mismatch. A clean replay may still print
-- V11's historical deprecation warning before this migration replaces the
-- constraint, but the final V12 schema contains no deprecated unary BINARY
-- expression.

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
						AND CAST(`toss_status` AS BINARY) IN (
							'READY',
							'IN_PROGRESS',
							'WAITING_FOR_DEPOSIT'
						)
					)
					OR (
						`status` = 'SUCCEEDED'
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
