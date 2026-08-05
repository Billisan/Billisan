-- Keep the database constraint focused on lifecycle ordering.
-- The application owns the due-at calculation policy (next whole hour + one day).
ALTER TABLE `rental`
	DROP CHECK `CK_RENTAL_LIFECYCLE_TIME_ORDER`,
	ADD CONSTRAINT `CK_RENTAL_LIFECYCLE_TIME_ORDER`
		CHECK (
			(`rented_at` IS NULL OR `rented_at` >= `requested_at`)
			AND (
				`due_at` IS NULL
				OR (
					`rented_at` IS NOT NULL
					AND `due_at` > `rented_at`
				)
			)
			AND (
				`ended_at` IS NULL
				OR (
					`rented_at` IS NOT NULL
					AND `ended_at` >= `rented_at`
				)
			)
		);
