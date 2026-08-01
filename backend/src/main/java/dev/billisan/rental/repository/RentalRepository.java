package dev.billisan.rental.repository;

import dev.billisan.rental.domain.Rental;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface RentalRepository extends JpaRepository<Rental, UUID> {
}
