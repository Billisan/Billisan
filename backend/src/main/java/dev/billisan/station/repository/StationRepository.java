package dev.billisan.station.repository;

import dev.billisan.station.domain.Station;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface StationRepository extends JpaRepository<Station, UUID> {
}
