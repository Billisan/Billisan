-- User rental-eligibility projection:
-- - RENTAL, RETURN_ATTEMPT, SETTLEMENT, and USER_ACCOUNT.face_registered
--   remain the authoritative business facts.
-- - USER_ACCOUNT.rental_eligible is a fail-closed read projection for fast
--   availability checks and must be revalidated from the authoritative facts
--   before a rental is created.
-- - Time-driven overdue settlement maintenance is implemented separately by
--   the Spring scheduler.
-- - Existing users are intentionally initialized to false without an eager
--   full-table derivation. A NULL evaluated_at distinguishes "not evaluated
--   yet" from an authoritative false result. Application events or a bounded
--   background job must evaluate those rows after deployment.

ALTER TABLE `user_account`
	ADD COLUMN `rental_eligible` BOOLEAN NOT NULL DEFAULT FALSE
		COMMENT 'Fail-closed rental eligibility projection; not a business SSOT',
	ADD COLUMN `rental_eligibility_evaluated_at` DATETIME(6) NULL
		COMMENT 'Last authoritative evaluation time; NULL means not evaluated yet',
	ADD CONSTRAINT `CK_USER_ACCOUNT_RENTAL_ELIGIBLE`
		CHECK (`rental_eligible` IN (0, 1)),
	ADD CONSTRAINT `CK_USER_ACCOUNT_RENTAL_ELIGIBILITY_EVALUATED`
		CHECK (`rental_eligible` = FALSE OR `rental_eligibility_evaluated_at` IS NOT NULL);
