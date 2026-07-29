CREATE TABLE IF NOT EXISTS `user_account` (
                                              `user_id`         CHAR(36)     NOT NULL,
    `login_id`        VARCHAR(100) NOT NULL,
    `password_hash`   VARCHAR(255) NOT NULL,
    `name`            VARCHAR(100) NOT NULL,
    `face_registered` BOOLEAN      NOT NULL DEFAULT FALSE,
    `created_at`      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`user_id`)
    );

CREATE TABLE IF NOT EXISTS `admin_account` (
                                               `admin_id`      CHAR(36)     NOT NULL,
    `login_id`      VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name`          VARCHAR(100) NOT NULL,
    `created_at`    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`admin_id`)
    );