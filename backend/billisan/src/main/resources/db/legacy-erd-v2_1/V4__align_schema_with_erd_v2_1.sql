ALTER TABLE user_account
    ADD COLUMN password_hash
        VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL
        AFTER login_id,
    ADD COLUMN name VARCHAR(100) NULL AFTER password_hash;

UPDATE user_account
SET name = login_id
WHERE name IS NULL;

UPDATE user_account
SET password_hash = '{migration-disabled}'
WHERE password_hash IS NULL;

ALTER TABLE user_account
    MODIFY COLUMN password_hash
        VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    MODIFY COLUMN name VARCHAR(100) NOT NULL,
    DROP CHECK chk_user_account_account_status,
    DROP COLUMN account_status;

CREATE TABLE face_profile_sync_operation (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    operation_type VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    template_version INT UNSIGNED NULL,
    sync_status VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    last_error_code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL,
    requested_at DATETIME(6) NOT NULL,
    completed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_face_profile_sync_operation PRIMARY KEY (id),
    CONSTRAINT uk_face_profile_sync_operation_request_id UNIQUE (request_id),
    CONSTRAINT fk_face_profile_sync_operation_user_account
        FOREIGN KEY (user_id) REFERENCES user_account (user_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_face_profile_sync_operation_type
        CHECK (operation_type IN ('REGISTER', 'REREGISTER', 'DELETE')),
    CONSTRAINT chk_face_profile_sync_operation_status
        CHECK (
            sync_status IN (
                'REQUESTED',
                'PROCESSING',
                'SUCCEEDED',
                'FAILED',
                'RECONCILIATION_REQUIRED'
            )
        ),
    INDEX idx_face_profile_sync_operation_user_status
        (user_id, sync_status)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

ALTER TABLE station
    ADD COLUMN current_boot_id
        VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL
        AFTER device_status,
    ADD COLUMN boot_synced_at DATETIME(6) NULL AFTER current_boot_id;

UPDATE station
SET current_boot_id = last_boot_id,
    boot_synced_at = CASE
        WHEN snapshot_recovery_reason IS NULL THEN last_boot_snapshot_at
        ELSE NULL
    END;

ALTER TABLE station
    DROP INDEX uk_station_last_boot_id,
    DROP CHECK chk_station_boot_snapshot_metadata,
    DROP CHECK chk_station_snapshot_recovery_metadata,
    DROP COLUMN last_boot_id,
    DROP COLUMN last_boot_snapshot_hash,
    DROP COLUMN last_boot_snapshot_at,
    DROP COLUMN snapshot_recovery_reason,
    DROP COLUMN snapshot_recovery_boot_id;

ALTER TABLE slot
    DROP CHECK chk_slot_item_condition,
    DROP CHECK chk_slot_service_status,
    DROP CHECK chk_slot_lock_status,
    DROP CHECK chk_slot_empty_item_condition,
    DROP CHECK chk_slot_snapshot_recovery_metadata;

UPDATE slot
SET service_status = CASE
        WHEN service_status IN ('MAINTENANCE', 'ERROR') THEN 'OUT_OF_SERVICE'
        WHEN service_status = 'ADMIN_REVIEW' THEN 'ADMIN_REVIEW'
        ELSE 'AVAILABLE'
    END;

UPDATE slot
SET item_condition = CASE
        WHEN occupancy_status = 'EMPTY' THEN 'EMPTY'
        WHEN occupancy_status = 'UNKNOWN' THEN 'UNKNOWN'
        WHEN item_condition = 'REVIEW_REQUIRED' THEN 'UNKNOWN'
        WHEN item_condition IS NULL THEN 'UNKNOWN'
        ELSE item_condition
    END;

UPDATE slot
SET service_status = 'ADMIN_REVIEW',
    item_condition = 'UNKNOWN'
WHERE occupancy_status = 'UNKNOWN';

UPDATE slot
SET service_status = 'ADMIN_REVIEW'
WHERE service_status = 'AVAILABLE'
  AND item_condition NOT IN ('EMPTY', 'NORMAL');

UPDATE slot
SET service_status = 'OUT_OF_SERVICE'
WHERE service_status = 'ADMIN_REVIEW'
  AND occupancy_status = 'EMPTY';

UPDATE slot
SET item_condition = CASE
        WHEN occupancy_status = 'EMPTY' THEN 'EMPTY'
        ELSE 'REPAIRABLE'
    END
WHERE service_status = 'OUT_OF_SERVICE'
  AND item_condition NOT IN ('EMPTY', 'DAMAGED', 'REPAIRABLE');

UPDATE slot
SET item_condition = 'UNKNOWN'
WHERE service_status = 'ADMIN_REVIEW'
  AND item_condition NOT IN ('UNKNOWN', 'DAMAGED', 'REPAIRABLE');

ALTER TABLE slot
    MODIFY COLUMN item_condition
        VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    DROP COLUMN snapshot_recovery_reason,
    DROP COLUMN snapshot_recovery_boot_id,
    ADD CONSTRAINT chk_slot_item_condition
        CHECK (
            item_condition IN (
                'EMPTY',
                'NORMAL',
                'DAMAGED',
                'REPAIRABLE',
                'UNKNOWN'
            )
        ),
    ADD CONSTRAINT chk_slot_service_status
        CHECK (
            service_status IN (
                'AVAILABLE',
                'ADMIN_REVIEW',
                'OUT_OF_SERVICE'
            )
        ),
    ADD CONSTRAINT chk_slot_lock_status
        CHECK (lock_status IN ('LOCKED', 'UNLOCKED', 'UNKNOWN', 'ERROR')),
    ADD CONSTRAINT chk_slot_occupancy_item_condition
        CHECK (
            (occupancy_status = 'EMPTY' AND item_condition = 'EMPTY')
            OR (
                occupancy_status = 'OCCUPIED'
                AND item_condition <> 'EMPTY'
            )
            OR (
                occupancy_status = 'UNKNOWN'
                AND item_condition = 'UNKNOWN'
            )
        ),
    ADD CONSTRAINT chk_slot_service_item_condition
        CHECK (
            (
                service_status = 'AVAILABLE'
                AND item_condition IN ('EMPTY', 'NORMAL')
            )
            OR (
                service_status = 'ADMIN_REVIEW'
                AND item_condition IN ('UNKNOWN', 'DAMAGED', 'REPAIRABLE')
            )
            OR (
                service_status = 'OUT_OF_SERVICE'
                AND item_condition IN ('EMPTY', 'DAMAGED', 'REPAIRABLE')
            )
        );

ALTER TABLE rental
    MODIFY COLUMN due_at DATETIME(6) NULL;

ALTER TABLE return_attempt
    MODIFY COLUMN return_slot_id
        CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE damage_inspection
    ADD COLUMN updated_at DATETIME(6) NULL AFTER reviewed_at;

UPDATE damage_inspection
SET updated_at = COALESCE(completed_at, requested_at)
WHERE updated_at IS NULL;

ALTER TABLE damage_inspection
    MODIFY COLUMN updated_at DATETIME(6) NOT NULL;

ALTER TABLE settlement
    ADD COLUMN paid_amount BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER amount,
    ADD CONSTRAINT chk_settlement_paid_amount
        CHECK (paid_amount <= amount);

ALTER TABLE payment_attempt
    ADD COLUMN creation_request_id
        VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL
        AFTER settlement_id,
    ADD COLUMN updated_at DATETIME(6) NULL AFTER completed_at;

UPDATE payment_attempt
SET creation_request_id = CONCAT('legacy-', payment_attempt_id),
    updated_at = COALESCE(completed_at, approved_at, requested_at)
WHERE creation_request_id IS NULL
   OR updated_at IS NULL;

ALTER TABLE payment_attempt
    MODIFY COLUMN creation_request_id
        VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    MODIFY COLUMN updated_at DATETIME(6) NOT NULL,
    DROP CHECK chk_payment_attempt_status,
    ADD CONSTRAINT uk_payment_attempt_creation_request_id
        UNIQUE (creation_request_id),
    ADD CONSTRAINT chk_payment_attempt_status
        CHECK (
            status IN (
                'REQUESTED',
                'PROCESSING',
                'SUCCEEDED',
                'FAILED',
                'CANCELLED'
            )
        );

ALTER TABLE device_operation
    ADD COLUMN issued_boot_id
        VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL
        AFTER event_id,
    ADD COLUMN terminal_event_type
        VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL
        AFTER status,
    ADD COLUMN observed_occupancy_status
        VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NULL
        AFTER result_code,
    ADD COLUMN observed_lock_status
        VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NULL
        AFTER observed_occupancy_status,
    ADD COLUMN evidence_schema_version SMALLINT UNSIGNED NULL
        AFTER observed_lock_status,
    ADD COLUMN evidence_observed_at DATETIME(6) NULL
        AFTER evidence_schema_version,
    ADD COLUMN evidence_payload JSON NULL AFTER evidence_observed_at;

UPDATE device_operation operation
JOIN station
  ON station.station_id = operation.station_id
SET operation.issued_boot_id = COALESCE(
        station.current_boot_id,
        CONCAT('legacy-', operation.operation_id)
    )
WHERE operation.issued_boot_id IS NULL;

UPDATE device_operation operation
JOIN slot
  ON slot.slot_id = operation.slot_id
SET operation.terminal_event_type = CASE
        WHEN operation.status = 'SUCCEEDED' THEN 'OPERATION_COMPLETED'
        ELSE 'OPERATION_FAILED'
    END,
    operation.observed_occupancy_status = slot.occupancy_status,
    operation.observed_lock_status = slot.lock_status,
    operation.evidence_schema_version = 1,
    operation.evidence_observed_at = COALESCE(
        operation.completed_at,
        operation.requested_at
    ),
    operation.evidence_payload = JSON_OBJECT(
        'source',
        'legacy-migration',
        'resultCode',
        operation.result_code
    )
WHERE operation.status IN ('SUCCEEDED', 'FAILED')
  AND operation.event_id IS NOT NULL;

UPDATE device_operation
SET status = 'OUTCOME_UNKNOWN',
    result_code = COALESCE(
        result_code,
        'LEGACY_TERMINAL_WITHOUT_EVENT'
    )
WHERE status IN ('SUCCEEDED', 'FAILED')
  AND event_id IS NULL;

ALTER TABLE device_operation
    MODIFY COLUMN issued_boot_id
        VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    MODIFY COLUMN status
        VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    DROP CHECK chk_device_operation_status,
    ADD CONSTRAINT chk_device_operation_status
        CHECK (
            status IN (
                'REQUESTED',
                'ACKED',
                'SUCCEEDED',
                'FAILED',
                'TIMED_OUT',
                'OUTCOME_UNKNOWN'
            )
        ),
    ADD CONSTRAINT chk_device_operation_terminal_event_type
        CHECK (
            terminal_event_type IS NULL
            OR terminal_event_type IN (
                'OPERATION_COMPLETED',
                'OPERATION_FAILED'
            )
        ),
    ADD CONSTRAINT chk_device_operation_observed_occupancy
        CHECK (
            observed_occupancy_status IS NULL
            OR observed_occupancy_status IN (
                'EMPTY',
                'OCCUPIED',
                'UNKNOWN'
            )
        ),
    ADD CONSTRAINT chk_device_operation_observed_lock
        CHECK (
            observed_lock_status IS NULL
            OR observed_lock_status IN (
                'LOCKED',
                'UNLOCKED',
                'UNKNOWN',
                'ERROR'
            )
        ),
    ADD CONSTRAINT chk_device_operation_terminal_evidence
        CHECK (
            status NOT IN ('SUCCEEDED', 'FAILED')
            OR (
                event_id IS NOT NULL
                AND terminal_event_type IS NOT NULL
                AND observed_occupancy_status IS NOT NULL
                AND observed_lock_status IS NOT NULL
                AND evidence_schema_version IS NOT NULL
                AND evidence_observed_at IS NOT NULL
            )
        ),
    ADD INDEX idx_device_operation_issued_boot_id (issued_boot_id);
