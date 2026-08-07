package dev.billisan.rental.repository;

import dev.billisan.rental.domain.Rental;
import dev.billisan.rental.domain.Rental.Status;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RentalRepository extends JpaRepository<Rental, UUID>, JpaSpecificationExecutor<Rental> {

    Optional<Rental> findByRentalRequestId(String rentalRequestId);

    /** EDGE-RETURN-001 — UK_RENTAL_ACTIVE_USER_GUARD 덕에 사용자당 최대 1건만 존재한다. */
    Optional<Rental> findByUserIdAndStatus(String userId, Rental.Status status);

    /**
     * EDGE-DEVICE-001 — 같은 물리 이벤트가 QoS 1로 중복 도착했을 때, 두 트랜잭션이
     * device_operation을 잠금 없이 동시에 "아직 처리 안 됨"으로 보고 상태 전이를
     * 중복 실행하지 않도록 조회 시점에 행을 잠근다(ReturnAttemptRepository.findByIdForUpdate와
     * 동일 이유).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Rental r where r.rentalId = :rentalId")
    Optional<Rental> findByIdForUpdate(@Param("rentalId") UUID rentalId);

    /** RENTAL-001 — 진행 중(REQUESTED/ACTIVE/RETURNING) 대여는 사용자당 최대 1건이다. */
    Optional<Rental> findFirstByUserIdAndStatusInOrderByRequestedAtDesc(String userId, List<Status> statuses);

    /** EDGE-DEVICE-001 PHYSICAL_STATE_CONFIRMED — slotId만으로 재확인 이벤트를 붙일 대여를 찾는다. */
    Optional<Rental> findFirstByCheckoutSlotIdAndStatusOrderByRequestedAtDesc(UUID checkoutSlotId, Status status);
}
