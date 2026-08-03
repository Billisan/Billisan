package dev.billisan.settlement.repository;

import dev.billisan.settlement.domain.Settlement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface SettlementRepository extends JpaRepository<Settlement, UUID> {

    /** {@code UK_SETTLEMENT_RENTAL_ID} — 대여 1건당 정산 1건. */
    Optional<Settlement> findByRentalId(UUID rentalId);
}
