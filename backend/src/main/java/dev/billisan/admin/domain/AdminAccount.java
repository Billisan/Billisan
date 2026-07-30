package dev.billisan.admin.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "admin_account")
public class AdminAccount {

    @Id
    @Column(name = "admin_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID adminId;

    @Column(name = "login_id", nullable = false, length = 100, unique = true)
    private String loginId;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected AdminAccount() {
    }

    private AdminAccount(UUID adminId, String loginId, String passwordHash, String name) {
        this.adminId = adminId;
        this.loginId = loginId;
        this.passwordHash = passwordHash;
        this.name = name;
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public static AdminAccount create(String loginId, String passwordHash, String name) {
        return new AdminAccount(UUID.randomUUID(), loginId, passwordHash, name);
    }

    @PreUpdate
    private void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public UUID getAdminId() {
        return adminId;
    }

    public String getLoginId() {
        return loginId;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getName() {
        return name;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}