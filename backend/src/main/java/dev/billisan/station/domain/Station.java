package dev.billisan.station.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "station")
public class Station {

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "station_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID stationId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_status", nullable = false, length = 30)
    private ServiceStatus serviceStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "device_status", nullable = false, length = 30)
    private DeviceStatus deviceStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Station() {
    }

    private Station(UUID stationId, String name, ServiceStatus serviceStatus, DeviceStatus deviceStatus) {
        this.stationId = stationId;
        this.name = name;
        this.serviceStatus = serviceStatus;
        this.deviceStatus = deviceStatus;
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public static Station create(String name, ServiceStatus serviceStatus, DeviceStatus deviceStatus) {
        return new Station(UUID.randomUUID(), name, serviceStatus, deviceStatus);
    }

    @PreUpdate
    private void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public UUID getStationId() {
        return stationId;
    }

    public String getName() {
        return name;
    }

    public ServiceStatus getServiceStatus() {
        return serviceStatus;
    }

    public DeviceStatus getDeviceStatus() {
        return deviceStatus;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public enum ServiceStatus {
        AVAILABLE, MAINTENANCE, OFFLINE
    }

    public enum DeviceStatus {
        ONLINE, OFFLINE, ERROR
    }
}
