CREATE TABLE IF NOT EXISTS `user_account` (
    `user_id`         CHAR(9)      NOT NULL COMMENT 'Exact nine-digit student number; Spring/MySQL business boundary only',
    `user_ref`        CHAR(36)     NOT NULL COMMENT 'Opaque UUID for face and device boundary; never derived from student number or login ID',
    `login_id`        VARCHAR(254) NOT NULL COMMENT 'Normalized university email; never the student number',
    `password_hash`   VARCHAR(255) NOT NULL,
    `name`            VARCHAR(100) NOT NULL,
    `face_registered` BOOLEAN      NOT NULL DEFAULT FALSE,
    `created_at`      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`user_id`),
    UNIQUE KEY `uk_user_account_login_id` (`login_id`),
    UNIQUE KEY `uk_user_account_user_ref` (`user_ref`)
);

CREATE TABLE IF NOT EXISTS `admin_account` (
    `admin_id`      CHAR(36)     NOT NULL,
    `login_id`      VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name`          VARCHAR(100) NOT NULL,
    `created_at`    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`admin_id`),
    UNIQUE KEY `uk_admin_account_login_id` (`login_id`)
);

CREATE TABLE IF NOT EXISTS `station` (
    `station_id`      CHAR(36)     NOT NULL,
    `name`            VARCHAR(100) NOT NULL,
    `service_status`  VARCHAR(30)  NOT NULL,
    `device_status`   VARCHAR(30)  NOT NULL,
    `current_boot_id` VARCHAR(100) NULL,
    `boot_synced_at`  DATETIME(6)  NULL,
    `last_seen_at`    DATETIME(6)  NULL,
    `created_at`      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`station_id`)
);

CREATE TABLE IF NOT EXISTS `slot` (
    `slot_id`          CHAR(36)    NOT NULL,
    `station_id`       CHAR(36)    NOT NULL,
    `slot_number`      INT         NOT NULL,
    `service_status`   VARCHAR(30) NOT NULL,
    `occupancy_status` VARCHAR(30) NOT NULL,
    `lock_status`      VARCHAR(30) NOT NULL,
    `item_condition`   VARCHAR(50) NULL,
    `created_at`       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`slot_id`)
);

CREATE TABLE IF NOT EXISTS `rental` (
    `rental_id`            CHAR(36)     NOT NULL,
    `user_id`              CHAR(9)      NOT NULL,
    `checkout_slot_id`     CHAR(36)     NOT NULL,
    `rental_request_id`    VARCHAR(100) NOT NULL COMMENT 'Opaque case-sensitive idempotency key',
    `status`               VARCHAR(30)  NOT NULL,
    `failure_code`         VARCHAR(100) NULL COMMENT 'Stable business failure code; never a raw exception type',
    `failure_message`      VARCHAR(500) NULL COMMENT 'Optional sanitized summary; no PII, stack trace, raw exception, or full MQTT payload',
    `failed_at`            DATETIME(6)  NULL,
    `requested_at`         DATETIME(6)  NOT NULL,
    `rented_at`            DATETIME(6)  NULL,
    `due_at`               DATETIME(6)  NULL,
    `ended_at`             DATETIME(6)  NULL,
    `created_at`           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `active_user_guard`    CHAR(9)      NULL,
    `requested_slot_guard` CHAR(36)     NULL,
    PRIMARY KEY (`rental_id`),
    UNIQUE KEY `uk_rental_rental_request_id` (`rental_request_id`),
    UNIQUE KEY `uk_rental_active_user_guard` (`active_user_guard`),
    UNIQUE KEY `uk_rental_requested_slot_guard` (`requested_slot_guard`)
);

CREATE TABLE IF NOT EXISTS `return_attempt` (
    `return_attempt_id`          CHAR(36)     NOT NULL,
    `rental_id`                  CHAR(36)     NOT NULL,
    `return_slot_id`             CHAR(36)     NULL COMMENT 'Spring-selected authoritative physical return slot after inspection',
    `request_id`                 VARCHAR(100) NOT NULL COMMENT 'Opaque case-sensitive idempotency key',
    `status`                     VARCHAR(30)  NOT NULL,
    `physical_completed_at`      DATETIME(6)  NULL,
    `completed_at`               DATETIME(6)  NULL,
    `failure_reason`             VARCHAR(255) NULL,
    `created_at`                 DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`                 DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `claimed_rental_guard`       CHAR(36)     NULL,
    `assigned_return_slot_guard` CHAR(36)     NOT NULL,
    PRIMARY KEY (`return_attempt_id`),
    UNIQUE KEY `uk_return_attempt_request_id` (`request_id`),
    UNIQUE KEY `uk_return_attempt_claimed_rental_guard` (`claimed_rental_guard`),
    UNIQUE KEY `uk_return_attempt_assigned_return_slot_guard` (`assigned_return_slot_guard`)
);

CREATE TABLE IF NOT EXISTS `damage_inspection` (
    `inspection_id`             CHAR(36)      NOT NULL,
    `return_attempt_id`         CHAR(36)      NOT NULL,
    `rental_id`                 CHAR(36)      NOT NULL,
    `request_id`                VARCHAR(100)  NOT NULL COMMENT 'Opaque case-sensitive idempotency key',
    `requested_at`              DATETIME(6)   NOT NULL COMMENT 'UTC time when Spring durably accepted the AI inspection request',
    `status`                    VARCHAR(30)   NOT NULL,
    `ai_result`                 VARCHAR(50)   NULL,
    `confidence`                DECIMAL(5, 4) NULL,
    `model_version`             VARCHAR(100)  NULL,
    `completed_at`              DATETIME(6)   NULL COMMENT 'UTC time when Spring durably stored the terminal AI result',
    `admin_decision`            VARCHAR(50)   NULL,
    `reviewed_by`               CHAR(36)      NULL,
    `reviewed_at`               DATETIME(6)   NULL,
    `created_at`                DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`                DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `settlement_eligible_guard` TINYINT       NOT NULL,
    PRIMARY KEY (`inspection_id`),
    UNIQUE KEY `uk_damage_inspection_request_id` (`request_id`),
    UNIQUE KEY `uk_damage_inspection_settlement_eligible_guard` (`settlement_eligible_guard`)
);

CREATE TABLE IF NOT EXISTS `settlement` (
    `settlement_id`        CHAR(36)     NOT NULL,
    `user_id`              CHAR(9)      NOT NULL,
    `rental_id`            CHAR(36)     NOT NULL,
    `damage_inspection_id` CHAR(36)     NULL COMMENT 'Administrator-reviewed DAMAGE_INSPECTION used as DAMAGE settlement basis',
    `reason`               VARCHAR(50)  NOT NULL,
    `amount`               BIGINT       NOT NULL,
    `paid_amount`          BIGINT       NOT NULL DEFAULT 0,
    `status`               VARCHAR(30)  NOT NULL,
    `created_at`           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `paid_at`              DATETIME(6)  NULL,
    `updated_at`           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `damage_basis_guard`   TINYINT      NOT NULL,
    PRIMARY KEY (`settlement_id`)
);

CREATE TABLE IF NOT EXISTS `payment_attempt` (
    `payment_attempt_id`   CHAR(36)     NOT NULL,
    `settlement_id`        CHAR(36)     NOT NULL,
    `creation_request_id`  VARCHAR(100) NOT NULL COMMENT 'Opaque case-sensitive idempotency key',
    `toss_order_id`        VARCHAR(100) NULL,
    `toss_payment_key`     VARCHAR(200) NULL,
    `amount`               BIGINT       NOT NULL,
    `provider`             VARCHAR(50)  NOT NULL,
    `toss_status`          VARCHAR(50)  NULL,
    `failure_code`         VARCHAR(100) NULL,
    `failure_message`      VARCHAR(500) NULL,
    `status`               VARCHAR(30)  NOT NULL,
    `requested_at`         DATETIME(6)  NOT NULL,
    `approved_at`          DATETIME(6)  NULL,
    `completed_at`         DATETIME(6)  NULL,
    `created_at`           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`payment_attempt_id`),
    UNIQUE KEY `uk_payment_attempt_creation_request_id` (`creation_request_id`),
    UNIQUE KEY `uk_payment_attempt_toss_order_id` (`toss_order_id`),
    UNIQUE KEY `uk_payment_attempt_toss_payment_key` (`toss_payment_key`)
);

CREATE TABLE IF NOT EXISTS `device_operation` (
    `operation_id`               CHAR(36)     NOT NULL,
    `station_id`                 CHAR(36)     NOT NULL,
    `slot_id`                    CHAR(36)     NULL,
    `command_id`                 VARCHAR(100) NOT NULL COMMENT 'Opaque case-sensitive command deduplication key',
    `event_id`                   VARCHAR(100) NULL COMMENT 'Opaque case-sensitive terminal-event deduplication key',
    `issued_boot_id`             VARCHAR(100) NULL,
    `operation_type`             VARCHAR(50)  NOT NULL,
    `status`                     VARCHAR(30)  NOT NULL,
    `terminal_event_type`        VARCHAR(50)  NULL,
    `result_code`                VARCHAR(100) NULL,
    `observed_occupancy_status`  VARCHAR(30)  NULL,
    `observed_lock_status`       VARCHAR(30)  NULL,
    `evidence_schema_version`    SMALLINT     NULL,
    `evidence_observed_at`       DATETIME(6)  NULL,
    `evidence_payload`           JSON         NULL,
    `requested_at`               DATETIME(6)  NOT NULL,
    `acked_at`                   DATETIME(6)  NULL,
    `completed_at`               DATETIME(6)  NULL,
    `created_at`                 DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`                 DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`operation_id`),
    UNIQUE KEY `uk_device_operation_command_id` (`command_id`),
    UNIQUE KEY `uk_device_operation_event_id` (`event_id`)
);

CREATE TABLE IF NOT EXISTS `face_profile_sync_operation` (
    `sync_operation_id` CHAR(36)     NOT NULL,
    `request_id`        VARCHAR(100) NOT NULL COMMENT 'Opaque case-sensitive idempotency key',
    `user_ref`          CHAR(36)     NOT NULL COMMENT 'Opaque USER_ACCOUNT.user_ref; never a student number',
    `operation_type`    VARCHAR(50)  NOT NULL,
    `template_version`  INT          NOT NULL,
    `sync_status`       VARCHAR(30)  NOT NULL,
    `last_error_code`   VARCHAR(100) NULL,
    `requested_at`      DATETIME(6)  NOT NULL,
    `completed_at`      DATETIME(6)  NULL,
    `created_at`        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`sync_operation_id`),
    UNIQUE KEY `uk_face_profile_sync_operation_request_id` (`request_id`)
);

CREATE TABLE IF NOT EXISTS `settlement_payment_mutation_guard` (
    `connection_id`         BIGINT      NOT NULL,
    `settlement_id`         CHAR(36)    NOT NULL,
    `expected_paid_amount`  BIGINT      NOT NULL,
    `expected_status`       VARCHAR(30) NOT NULL,
    `expected_paid_at`      DATETIME(6) NULL,
    `created_at`            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`connection_id`)
);
