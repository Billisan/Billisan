CREATE TABLE user_account (
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    login_id VARCHAR(100) NOT NULL,
    role VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    account_status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    face_registered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_user_account PRIMARY KEY (user_id),
    CONSTRAINT uk_user_account_login_id UNIQUE (login_id),
    CONSTRAINT chk_user_account_role
        CHECK (role IN ('USER', 'ADMIN')),
    CONSTRAINT chk_user_account_account_status
        CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'WITHDRAWN'))
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE station (
    station_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    station_code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    location_text VARCHAR(255) NULL,
    service_status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    device_status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    last_seen_at DATETIME(6) NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_station PRIMARY KEY (station_id),
    CONSTRAINT uk_station_station_code UNIQUE (station_code),
    CONSTRAINT chk_station_service_status
        CHECK (service_status IN ('AVAILABLE', 'MAINTENANCE', 'OFFLINE')),
    CONSTRAINT chk_station_device_status
        CHECK (device_status IN ('ONLINE', 'OFFLINE', 'ERROR'))
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE slot (
    slot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    station_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    slot_number INT NOT NULL,
    item_condition VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
    service_status VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    occupancy_status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    lock_status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_slot PRIMARY KEY (slot_id),
    CONSTRAINT uk_slot_station_id_slot_number UNIQUE (station_id, slot_number),
    CONSTRAINT fk_slot_station
        FOREIGN KEY (station_id) REFERENCES station (station_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_slot_item_condition
        CHECK (
            item_condition IS NULL
            OR item_condition IN ('NORMAL', 'REVIEW_REQUIRED', 'DAMAGED', 'UNKNOWN')
        ),
    CONSTRAINT chk_slot_service_status
        CHECK (
            service_status IN (
                'AVAILABLE',
                'RENTING',
                'RETURNING',
                'ADMIN_REVIEW',
                'MAINTENANCE',
                'ERROR'
            )
        ),
    CONSTRAINT chk_slot_occupancy_status
        CHECK (occupancy_status IN ('OCCUPIED', 'EMPTY', 'UNKNOWN')),
    CONSTRAINT chk_slot_lock_status
        CHECK (lock_status IN ('LOCKED', 'UNLOCKED', 'ERROR')),
    CONSTRAINT chk_slot_empty_item_condition
        CHECK (occupancy_status <> 'EMPTY' OR item_condition IS NULL)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE rental (
    rental_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    checkout_slot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rental_request_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    requested_at DATETIME(6) NOT NULL,
    rented_at DATETIME(6) NULL,
    due_at DATETIME(6) NOT NULL,
    ended_at DATETIME(6) NULL,
    failure_reason VARCHAR(100) NULL,
    CONSTRAINT pk_rental PRIMARY KEY (rental_id),
    CONSTRAINT uk_rental_rental_request_id UNIQUE (rental_request_id),
    CONSTRAINT fk_rental_user_account
        FOREIGN KEY (user_id) REFERENCES user_account (user_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_rental_slot
        FOREIGN KEY (checkout_slot_id) REFERENCES slot (slot_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_rental_status
        CHECK (
            status IN (
                'REQUESTED',
                'ACTIVE',
                'RETURNING',
                'COMPLETED',
                'LOST',
                'CANCELLED',
                'FAILED'
            )
        ),
    INDEX idx_rental_user_status (user_id, status),
    INDEX idx_rental_checkout_slot_status (checkout_slot_id, status)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE return_attempt (
    return_attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rental_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    return_slot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    physical_completed_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    failure_reason VARCHAR(100) NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_return_attempt PRIMARY KEY (return_attempt_id),
    CONSTRAINT uk_return_attempt_request_id UNIQUE (request_id),
    CONSTRAINT fk_return_attempt_rental
        FOREIGN KEY (rental_id) REFERENCES rental (rental_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_return_attempt_slot
        FOREIGN KEY (return_slot_id) REFERENCES slot (slot_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_return_attempt_status
        CHECK (
            status IN (
                'PROCESSING',
                'PHYSICAL_DONE',
                'COMPLETED',
                'RECOVERY_REQUIRED',
                'FAILED'
            )
        ),
    INDEX idx_return_attempt_rental_status (rental_id, status),
    INDEX idx_return_attempt_slot_status (return_slot_id, status)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE damage_inspection (
    inspection_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    return_attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    ai_result VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NULL,
    confidence DECIMAL(5, 4) NULL,
    model_version VARCHAR(50) NULL,
    admin_decision VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
    reviewed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    reviewed_at DATETIME(6) NULL,
    requested_at DATETIME(6) NOT NULL,
    completed_at DATETIME(6) NULL,
    CONSTRAINT pk_damage_inspection PRIMARY KEY (inspection_id),
    CONSTRAINT uk_damage_inspection_return_attempt_id UNIQUE (return_attempt_id),
    CONSTRAINT uk_damage_inspection_request_id UNIQUE (request_id),
    CONSTRAINT fk_damage_inspection_return_attempt
        FOREIGN KEY (return_attempt_id) REFERENCES return_attempt (return_attempt_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_damage_inspection_status
        CHECK (status IN ('REQUESTED', 'COMPLETED', 'FAILED')),
    CONSTRAINT chk_damage_inspection_ai_result
        CHECK (
            ai_result IS NULL
            OR ai_result IN ('NORMAL', 'DAMAGED', 'UNCERTAIN', 'FAILED')
        ),
    CONSTRAINT chk_damage_inspection_confidence
        CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
    CONSTRAINT chk_damage_inspection_admin_decision
        CHECK (
            admin_decision IS NULL
            OR admin_decision IN ('NORMAL', 'DAMAGED')
        )
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE settlement (
    settlement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rental_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    return_attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    reason VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    amount BIGINT UNSIGNED NOT NULL,
    status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    paid_at DATETIME(6) NULL,
    CONSTRAINT pk_settlement PRIMARY KEY (settlement_id),
    CONSTRAINT uk_settlement_rental_id UNIQUE (rental_id),
    CONSTRAINT uk_settlement_return_attempt_id UNIQUE (return_attempt_id),
    CONSTRAINT fk_settlement_user_account
        FOREIGN KEY (user_id) REFERENCES user_account (user_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_settlement_rental
        FOREIGN KEY (rental_id) REFERENCES rental (rental_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_settlement_return_attempt
        FOREIGN KEY (return_attempt_id) REFERENCES return_attempt (return_attempt_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_settlement_reason
        CHECK (reason IN ('OVERDUE', 'LOSS', 'DAMAGE', 'ADJUSTMENT')),
    CONSTRAINT chk_settlement_amount
        CHECK (amount >= 0),
    CONSTRAINT chk_settlement_status
        CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
    INDEX idx_settlement_user_status (user_id, status)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE payment_attempt (
    payment_attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    settlement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    toss_order_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    toss_payment_key VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NULL,
    amount BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    toss_status VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
    failure_code VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NULL,
    failure_message VARCHAR(500) NULL,
    requested_at DATETIME(6) NOT NULL,
    approved_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    CONSTRAINT pk_payment_attempt PRIMARY KEY (payment_attempt_id),
    CONSTRAINT uk_payment_attempt_toss_order_id UNIQUE (toss_order_id),
    CONSTRAINT uk_payment_attempt_toss_payment_key UNIQUE (toss_payment_key),
    CONSTRAINT fk_payment_attempt_settlement
        FOREIGN KEY (settlement_id) REFERENCES settlement (settlement_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_payment_attempt_amount
        CHECK (amount >= 0),
    CONSTRAINT chk_payment_attempt_provider
        CHECK (provider IN ('MOCK', 'TOSS_SANDBOX')),
    CONSTRAINT chk_payment_attempt_status
        CHECK (status IN ('REQUESTED', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
    CONSTRAINT chk_payment_attempt_toss_order_id
        CHECK (
            CHAR_LENGTH(toss_order_id) BETWEEN 6 AND 64
            AND toss_order_id REGEXP '^[A-Za-z0-9_-]+$'
        )
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE device_operation (
    operation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    station_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    slot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rental_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    return_attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    command_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    event_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
    operation_type VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    result_code VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NULL,
    requested_at DATETIME(6) NOT NULL,
    acked_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    CONSTRAINT pk_device_operation PRIMARY KEY (operation_id),
    CONSTRAINT uk_device_operation_command_id UNIQUE (command_id),
    CONSTRAINT uk_device_operation_event_id UNIQUE (event_id),
    CONSTRAINT fk_device_operation_station
        FOREIGN KEY (station_id) REFERENCES station (station_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_device_operation_slot
        FOREIGN KEY (slot_id) REFERENCES slot (slot_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_device_operation_rental
        FOREIGN KEY (rental_id) REFERENCES rental (rental_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_device_operation_return_attempt
        FOREIGN KEY (return_attempt_id) REFERENCES return_attempt (return_attempt_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_device_operation_type
        CHECK (operation_type IN ('UNLOCK', 'LOCK', 'VERIFY_SLOT')),
    CONSTRAINT chk_device_operation_status
        CHECK (status IN ('REQUESTED', 'ACKED', 'SUCCEEDED', 'FAILED', 'TIMED_OUT'))
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;
