# Demo state scenarios

## Application contract

- Rebuild a disposable MySQL Demo DB and apply Flyway V1-V19 first.
- Apply the baseline Fixtures in order: `00`, `10`, `20`, `30`, `40`.
- Apply exactly one Scenario file from `31`-`44`.
- Run `90-verify-scenario.sql` immediately after the Scenario.
- Reapplying the same Scenario validates its fixed graph and recalculates the projection.
- Applying a different Scenario over an existing Scenario fails.
- Scenario SQL uses fixed UUIDs and `fixture-scenario-*` request keys; it never selects a user by row order.

## Projection rule

Every Scenario updates `USER_ACCOUNT.rental_eligible` only after creating its authoritative data. The value is recalculated as:

- `face_registered`
- AND no `REQUESTED`, `ACTIVE`, or `RETURNING` Rental
- AND no `RECOVERY_REQUIRED` Return Attempt
- AND no Settlement whose `paid_amount < amount`

`rental_eligibility_evaluated_at` is written with a deterministic Scenario timestamp. The SQL does not claim that unimplemented REST flows exist.

## Target catalog

| Scenario | user_id | user_ref |
|---|---|---|
| 31 | `202600001` | `f6f509d4-c001-446c-b6b7-537d65a093c3` |
| 32 | `202600002` | `f86a8791-c02b-4e50-b761-d9dd009909a9` |
| 33 | `202600007` | `bb14cac2-74d1-4b7f-a69f-aa88fcf8f55e` |
| 34 | `202600003` | `0b8255a1-70e4-45af-80f2-b38e4164ea06` |
| 35 | `202600004` | `59b97d2b-a37d-4f75-bd33-4beb1bd3ac76` |
| 36 | `202600005` | `d8a6f8d6-3c43-4789-b980-a9f6918d53b8` |
| 41 | `202600004` | `59b97d2b-a37d-4f75-bd33-4beb1bd3ac76` |
| 42 | `202600006` | `3650e75c-ab2b-4455-8f00-c691fd2e66fb` |
| 43 | `202600004` | `59b97d2b-a37d-4f75-bd33-4beb1bd3ac76` |
| 44 | `202600006` | `3650e75c-ab2b-4455-8f00-c691fd2e66fb` |

## Reset policy

- For ACTIVE or recovery flows, prefer a supported application/API completion path when that path is implemented.
- Do not reverse successful payments, damage settlements, or administrator decisions with DELETE or UPDATE.
- Rebuild the disposable MySQL Demo DB to reset immutable or partially applied Scenario data.
- Do not run destructive reset SQL against the shared EC2 database.
- Keep the six Orin PostgreSQL face profiles; Scenario reset does not rebuild or alter Orin PostgreSQL.
