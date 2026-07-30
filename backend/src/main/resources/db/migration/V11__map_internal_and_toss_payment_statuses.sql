-- P1-6: Authoritative mapping between Billisan payment-attempt status and
-- the raw Toss Payments status observed by the Spring payment adapter.
--
-- Official Toss Payment status values verified for this baseline:
-- READY, IN_PROGRESS, WAITING_FOR_DEPOSIT, DONE, CANCELED,
-- PARTIAL_CANCELED, ABORTED, EXPIRED.
--
-- Internal mapping:
--   REQUESTED  <-> no Toss object/status observed yet
--   PROCESSING <-> READY | IN_PROGRESS | WAITING_FOR_DEPOSIT
--   SUCCEEDED  <-> DONE
--   FAILED     <-> local failure with NULL, or ABORTED | EXPIRED
--   CANCELLED  <-> local cancellation with NULL, or CANCELED
--
-- PARTIAL_CANCELED is not mapped to CANCELLED because PAYMENT_ATTEMPT has no
-- captured/refunded/net amount fields. It must be stored with
-- RECONCILIATION_REQUIRED until Spring reconciles the cumulative SETTLEMENT.
-- The same reconciliation state preserves newly introduced Toss statuses and
-- rare provider reversals such as DONE -> WAITING_FOR_DEPOSIT without lying
-- about Billisan's official financial state.
--
-- CHECK constraints validate the current row only. Webhook idempotency,
-- transition legality, prior-state comparison, SETTLEMENT paid_amount update,
-- and out-of-order event handling remain one Spring transaction guarded by
-- row locking or updated_at CAS.
--
-- Existing rows are not rewritten. Inconsistent legacy mappings block this
-- migration and require explicit reconciliation.

ALTER TABLE `payment_attempt`
	DROP CHECK `CK_PAYMENT_STATUS`,
	DROP CHECK `CK_PAYMENT_ATTEMPT_STATE_TIME_COMPLETENESS`;

ALTER TABLE `payment_attempt`
	ADD CONSTRAINT `CK_PAYMENT_STATUS`
		CHECK (
			`status` IN (
				'REQUESTED',
				'PROCESSING',
				'SUCCEEDED',
				'FAILED',
				'CANCELLED',
				'RECONCILIATION_REQUIRED'
			)
		),
	ADD CONSTRAINT `CK_PAYMENT_ATTEMPT_STATE_TIME_COMPLETENESS`
		CHECK (
			(
				`status` = 'REQUESTED'
				AND `approved_at` IS NULL
				AND `completed_at` IS NULL
			)
			OR (
				`status` = 'PROCESSING'
				AND `completed_at` IS NULL
			)
			OR (
				`status` = 'SUCCEEDED'
				AND `approved_at` IS NOT NULL
				AND `completed_at` IS NOT NULL
			)
			OR (
				`status` IN (
					'FAILED',
					'CANCELLED',
					'RECONCILIATION_REQUIRED'
				)
				AND `completed_at` IS NOT NULL
			)
		),
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
						AND BINARY `toss_status` IN (
							'READY',
							'IN_PROGRESS',
							'WAITING_FOR_DEPOSIT'
						)
					)
					OR (
						`status` = 'SUCCEEDED'
						AND BINARY `toss_status` = 'DONE'
					)
					OR (
						`status` = 'FAILED'
						AND (
							`toss_status` IS NULL
							OR BINARY `toss_status` IN ('ABORTED', 'EXPIRED')
						)
					)
					OR (
						`status` = 'CANCELLED'
						AND (
							`toss_status` IS NULL
							OR BINARY `toss_status` = 'CANCELED'
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
