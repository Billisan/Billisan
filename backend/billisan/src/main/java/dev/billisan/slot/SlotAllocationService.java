package dev.billisan.slot;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SlotAllocationService {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	private final SlotAllocationRepository repository;

	public SlotAllocationService(SlotAllocationRepository repository) {
		this.repository = repository;
	}

	@Transactional
	public RentalAllocationResult allocateRentalSlot(
		RentalAllocationCommand command
	) {
		validate(command);

		LocalDateTime requestedAt = now();
		if (!command.dueAt().isAfter(requestedAt)) {
			throw new IllegalArgumentException("dueAt must be after allocation time");
		}

		String slotId = repository
			.lockNextRentalSlot(command.stationId())
			.orElseThrow(() -> new SlotUnavailableException(
				command.stationId(),
				WorkType.RENTAL
			));
		if (repository.markSlotRenting(slotId, requestedAt) != 1) {
			throw new SlotUnavailableException(command.stationId(), WorkType.RENTAL);
		}

		String rentalId = UUID.randomUUID().toString();
		repository.insertRental(
			rentalId,
			command.userId(),
			slotId,
			command.rentalRequestId(),
			requestedAt,
			command.dueAt()
		);
		return new RentalAllocationResult(
			rentalId,
			command.rentalRequestId(),
			command.stationId(),
			slotId,
			"REQUESTED",
			requestedAt
		);
	}

	@Transactional
	public ReturnAllocationResult allocateReturnSlot(
		ReturnAllocationCommand command
	) {
		validate(command);

		LocalDateTime createdAt = now();
		String slotId = repository
			.lockNextReturnSlot(command.stationId())
			.orElseThrow(() -> new SlotUnavailableException(
				command.stationId(),
				WorkType.RETURN
			));
		if (repository.markSlotReturning(slotId, createdAt) != 1) {
			throw new SlotUnavailableException(command.stationId(), WorkType.RETURN);
		}

		String returnAttemptId = UUID.randomUUID().toString();
		repository.insertReturnAttempt(
			returnAttemptId,
			command.rentalId(),
			slotId,
			command.requestId(),
			createdAt
		);
		return new ReturnAllocationResult(
			returnAttemptId,
			command.requestId(),
			command.rentalId(),
			command.stationId(),
			slotId,
			"PROCESSING",
			createdAt
		);
	}

	private void validate(RentalAllocationCommand command) {
		Objects.requireNonNull(command, "command");
		requireText(command.rentalRequestId(), "rentalRequestId");
		requireText(command.userId(), "userId");
		requireText(command.stationId(), "stationId");
		Objects.requireNonNull(command.dueAt(), "dueAt");
	}

	private void validate(ReturnAllocationCommand command) {
		Objects.requireNonNull(command, "command");
		requireText(command.requestId(), "requestId");
		requireText(command.rentalId(), "rentalId");
		requireText(command.stationId(), "stationId");
	}

	private static void requireText(String value, String field) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(field + " must not be blank");
		}
	}

	private static LocalDateTime now() {
		LocalDateTime current = LocalDateTime.now(BUSINESS_ZONE);
		return current.withNano(current.getNano() / 1_000 * 1_000);
	}

	public enum WorkType {
		RENTAL,
		RETURN
	}

	public record RentalAllocationCommand(
		String rentalRequestId,
		String userId,
		String stationId,
		LocalDateTime dueAt
	) {
	}

	public record RentalAllocationResult(
		String rentalId,
		String rentalRequestId,
		String stationId,
		String slotId,
		String status,
		LocalDateTime requestedAt
	) {
	}

	public record ReturnAllocationCommand(
		String requestId,
		String rentalId,
		String stationId
	) {
	}

	public record ReturnAllocationResult(
		String returnAttemptId,
		String requestId,
		String rentalId,
		String stationId,
		String slotId,
		String status,
		LocalDateTime createdAt
	) {
	}
}
