# Live demo database preparation

These scripts prepare the project-only live demonstration database without
loading `demo-fixtures` or rebuilding existing MySQL and PostgreSQL data.

They are intentionally outside `db/migration`, so Flyway never executes them.

## Order

1. Apply Flyway through V20.
2. Back up the live demonstration MySQL database.
3. Run `00-prepare-station-and-slots.sql` without `--force`.
4. Copy the returned station/slot mapping to the Pi configuration.
5. Run `90-verify-live-demo.sql` and review every result set.
6. Compare the MySQL `user_ref` result with PostgreSQL using:

   ```sql
   SELECT user_ref, model_version, template_version
   FROM face_profile
   ORDER BY user_ref;
   ```

The preparation script never updates an existing station or slot. It reuses
existing slot IDs by `(station_id, slot_number)` and creates only a missing
rent slot 1 and return slot 2. If it creates a slot, its returned UUID must be
configured on the Pi because `slotId` is part of the physical device contract.

The verification script is read-only. It reports stale rentals and device
operations but never deletes or repairs them automatically.
