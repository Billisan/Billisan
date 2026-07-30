CREATE INDEX idx_slot_station_allocation_candidate
    ON slot (
        station_id,
        service_status,
        occupancy_status,
        lock_status,
        item_condition,
        slot_number
    );
