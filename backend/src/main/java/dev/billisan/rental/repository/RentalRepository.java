package dev.billisan.rental.repository;

import dev.billisan.rental.domain.Rental;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RentalRepository extends JpaRepository<Rental, UUID> {

    Optional<Rental> findByRentalRequestId(String rentalRequestId);

    /** EDGE-RETURN-001 — UK_RENTAL_ACTIVE_USER_GUARD 덕에 사용자당 최대 1건만 존재한다. */
    Optional<Rental> findByUserIdAndStatus(String userId, Rental.Status status);
}
