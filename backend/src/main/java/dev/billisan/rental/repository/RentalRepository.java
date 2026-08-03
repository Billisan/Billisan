package dev.billisan.rental.repository;

import dev.billisan.rental.domain.Rental;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RentalRepository extends JpaRepository<Rental, UUID> {

    Optional<Rental> findByRentalRequestId(String rentalRequestId);

    boolean existsByUserIdAndStatusIn(String userId, Collection<Rental.Status> statuses);
}
