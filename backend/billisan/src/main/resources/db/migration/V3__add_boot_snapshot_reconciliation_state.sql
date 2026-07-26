ALTER TABLE station
    ADD COLUMN last_boot_id
        VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD COLUMN last_boot_snapshot_hash
        CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD COLUMN last_boot_snapshot_at DATETIME(6) NULL,
    ADD COLUMN snapshot_recovery_reason
        VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD COLUMN snapshot_recovery_boot_id
        VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD CONSTRAINT uk_station_last_boot_id UNIQUE (last_boot_id),
    ADD CONSTRAINT chk_station_boot_snapshot_metadata
        CHECK (
            (
                last_boot_id IS NULL
                AND last_boot_snapshot_hash IS NULL
                AND last_boot_snapshot_at IS NULL
            )
            OR (
                last_boot_id IS NOT NULL
                AND last_boot_snapshot_hash IS NOT NULL
                AND last_boot_snapshot_at IS NOT NULL
            )
        ),
    ADD CONSTRAINT chk_station_snapshot_recovery_metadata
        CHECK (
            (
                snapshot_recovery_reason IS NULL
                AND snapshot_recovery_boot_id IS NULL
            )
            OR (
                snapshot_recovery_reason IS NOT NULL
                AND snapshot_recovery_boot_id IS NOT NULL
            )
        );

ALTER TABLE slot
    ADD COLUMN snapshot_recovery_reason
        VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD COLUMN snapshot_recovery_boot_id
        VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD CONSTRAINT chk_slot_snapshot_recovery_metadata
        CHECK (
            (
                snapshot_recovery_reason IS NULL
                AND snapshot_recovery_boot_id IS NULL
            )
            OR (
                snapshot_recovery_reason IS NOT NULL
                AND snapshot_recovery_boot_id IS NOT NULL
            )
        );
