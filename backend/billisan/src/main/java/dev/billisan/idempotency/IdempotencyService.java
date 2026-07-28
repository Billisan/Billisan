package dev.billisan.idempotency;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Objects;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import dev.billisan.idempotency.IdempotencyRepository.DeviceOperationRow;
import dev.billisan.idempotency.IdempotencyRepository.PaymentAttemptRow;
import dev.billisan.idempotency.IdempotencyRepository.ReturnAttemptRow;
import dev.billisan.idempotency.IdempotencyRepository.SettlementRow;

@Service
public class IdempotencyService {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	private final IdempotencyRepository repository;

	public IdempotencyService(IdempotencyRepository repository) {
		this.repository = repository;
	}

	@Transactional
	public ReturnAttemptResult createReturnAttempt(ReturnAttemptCommand command) {
		validate(command);

		String generatedId = UUID.randomUUID().toString();
		LocalDateTime createdAt = now();
		repository.upsertReturnAttempt(
			generatedId,
			command.rentalId(),
			command.returnSlotId(),
			command.requestId(),
			createdAt
		);

		ReturnAttemptRow stored = repository
			.findReturnAttemptByRequestId(command.requestId())
			.orElseThrow(() -> new IllegalStateException(
				"Return attempt was not readable after upsert"
			));
		requireSameReturnPayload(stored, command);

		Outcome outcome = stored.returnAttemptId().equals(generatedId)
			? Outcome.APPLIED
			: Outcome.REPLAYED;

		return new ReturnAttemptResult(
			stored.returnAttemptId(),
			stored.requestId(),
			stored.status(),
			stored.createdAt(),
			outcome
		);
	}

	@Transactional
	public DeviceCommandResult registerDeviceCommand(DeviceCommand command) {
		validate(command);
		if (!repository.isStationBootSynchronized(
			command.stationId(),
			command.issuedBootId()
		)) {
			throw new IllegalStateException(
				"Station boot snapshot is not synchronized"
			);
		}

		String generatedId = UUID.randomUUID().toString();
		LocalDateTime requestedAt = now();
		repository.upsertDeviceOperation(
			generatedId,
			command.stationId(),
			command.slotId(),
			command.rentalId(),
			command.returnAttemptId(),
			command.commandId(),
			command.issuedBootId(),
			command.operationType(),
			requestedAt
		);

		DeviceOperationRow stored = repository
			.lockDeviceOperationByCommandId(command.commandId())
			.orElseThrow(() -> new IllegalStateException(
				"Device command was not readable after upsert"
			));
		requireSameCommandPayload(stored, command);

		return new DeviceCommandResult(
			stored.operationId(),
			stored.commandId(),
			stored.status(),
			stored.requestedAt(),
			stored.operationId().equals(generatedId)
				? Outcome.APPLIED
				: Outcome.REPLAYED
		);
	}

	@Transactional
	public DeviceEventResult applyDeviceEvent(DeviceEvent event) {
		validate(event);

		DeviceOperationRow existingEvent = repository
			.findDeviceOperationByEventId(event.eventId())
			.orElse(null);
		if (existingEvent != null) {
			return replayDeviceEvent(existingEvent, event);
		}

		DeviceOperationRow operation = repository
			.lockDeviceOperationByCommandId(event.commandId())
			.orElseThrow(() -> new IllegalArgumentException("Unknown commandId"));

		if (operation.eventId() != null) {
			if (operation.eventId().equals(event.eventId())) {
				return replayDeviceEvent(operation, event);
			}
			throw new IdempotencyConflictException("commandId", event.commandId());
		}
		requireSameEventTarget(operation, event);

		String operationStatus = event.success() ? "SUCCEEDED" : "FAILED";
		try {
			if (repository.completeDeviceOperation(
				operation.operationId(),
				event.eventId(),
				event.bootId(),
				operationStatus,
				event.resultCode(),
				event.occupancyStatus(),
				event.lockStatus(),
				event.occurredAt()
			) != 1) {
				throw new IllegalStateException("Device event was not applied exactly once");
			}
		} catch (DuplicateKeyException exception) {
			throw new IdempotencyConflictException(
				"eventId",
				event.eventId(),
				exception
			);
		}

		if (repository.updateSlotPhysicalState(
			event.slotId(),
			event.occupancyStatus(),
			event.lockStatus(),
			operation.returnAttemptId() != null,
			event.occurredAt()
		) != 1) {
			throw new IllegalStateException("Device event slot does not exist");
		}

		return new DeviceEventResult(
			operation.operationId(),
			event.commandId(),
			event.eventId(),
			operationStatus,
			event.occurredAt(),
			Outcome.APPLIED
		);
	}

	@Transactional
	public PaymentApprovalResult approvePayment(PaymentApproval command) {
		validate(command);

		PaymentAttemptRow payment = repository
			.lockPaymentAttempt(command.paymentAttemptId())
			.orElseThrow(() -> new IllegalArgumentException("Unknown paymentAttemptId"));
		requireSamePaymentPayload(payment, command);

		SettlementRow settlement = repository
			.lockSettlement(payment.settlementId())
			.orElseThrow(() -> new IllegalStateException("Payment settlement does not exist"));
		if (settlement.amount() != command.amount()) {
			throw new IdempotencyConflictException(
				"paymentAttemptId",
				command.paymentAttemptId()
			);
		}

		if ("SUCCEEDED".equals(payment.status())) {
			if (Objects.equals(payment.tossPaymentKey(), command.paymentKey())
				&& "PAID".equals(settlement.status())) {
				return new PaymentApprovalResult(
					payment.paymentAttemptId(),
					payment.settlementId(),
					payment.tossPaymentKey(),
					payment.status(),
					payment.approvedAt(),
					Outcome.REPLAYED
				);
			}
			throw new IdempotencyConflictException(
				"paymentAttemptId",
				command.paymentAttemptId()
			);
		}

		if (!"REQUESTED".equals(payment.status())
			|| payment.tossPaymentKey() != null
			|| !"PENDING".equals(settlement.status())) {
			throw new IdempotencyConflictException(
				"paymentAttemptId",
				command.paymentAttemptId()
			);
		}

		PaymentAttemptRow paymentKeyOwner = repository
			.findPaymentAttemptByPaymentKey(command.paymentKey())
			.orElse(null);
		if (paymentKeyOwner != null
			&& !paymentKeyOwner.paymentAttemptId().equals(command.paymentAttemptId())) {
			throw new IdempotencyConflictException("paymentKey", command.paymentKey());
		}

		LocalDateTime approvedAt = now();
		try {
			if (repository.approvePaymentAttempt(
				command.paymentAttemptId(),
				command.paymentKey(),
				approvedAt
			) != 1) {
				throw new IllegalStateException("Payment approval was not applied exactly once");
			}
		} catch (DuplicateKeyException exception) {
			throw new IdempotencyConflictException(
				"paymentKey",
				command.paymentKey(),
				exception
			);
		}

		if (repository.markSettlementPaid(payment.settlementId(), approvedAt) != 1) {
			throw new IllegalStateException("Settlement was not paid exactly once");
		}

		return new PaymentApprovalResult(
			payment.paymentAttemptId(),
			payment.settlementId(),
			command.paymentKey(),
			"SUCCEEDED",
			approvedAt,
			Outcome.APPLIED
		);
	}

	private DeviceEventResult replayDeviceEvent(
		DeviceOperationRow stored,
		DeviceEvent event
	) {
		requireSameEventPayload(stored, event);
		return new DeviceEventResult(
			stored.operationId(),
			stored.commandId(),
			stored.eventId(),
			stored.status(),
			stored.completedAt(),
			Outcome.REPLAYED
		);
	}

	private void requireSameReturnPayload(
		ReturnAttemptRow stored,
		ReturnAttemptCommand command
	) {
		if (!stored.rentalId().equals(command.rentalId())
			|| !Objects.equals(stored.returnSlotId(), command.returnSlotId())) {
			throw new IdempotencyConflictException("requestId", command.requestId());
		}
	}

	private void requireSameCommandPayload(
		DeviceOperationRow stored,
		DeviceCommand command
	) {
		if (!stored.stationId().equals(command.stationId())
			|| !stored.slotId().equals(command.slotId())
			|| !Objects.equals(stored.rentalId(), command.rentalId())
			|| !Objects.equals(stored.returnAttemptId(), command.returnAttemptId())
			|| !stored.issuedBootId().equals(command.issuedBootId())
			|| !stored.operationType().equals(command.operationType())) {
			throw new IdempotencyConflictException("commandId", command.commandId());
		}
	}

	private void requireSameEventTarget(
		DeviceOperationRow operation,
		DeviceEvent event
	) {
		if (!operation.commandId().equals(event.commandId())
			|| !operation.slotId().equals(event.slotId())
			|| !operation.issuedBootId().equals(event.bootId())) {
			throw new IdempotencyConflictException("eventId", event.eventId());
		}
	}

	private void requireSameEventPayload(
		DeviceOperationRow stored,
		DeviceEvent event
	) {
		String expectedStatus = event.success() ? "SUCCEEDED" : "FAILED";
		if (!stored.commandId().equals(event.commandId())
			|| !stored.slotId().equals(event.slotId())
			|| !stored.issuedBootId().equals(event.bootId())
			|| !stored.status().equals(expectedStatus)
			|| !Objects.equals(stored.resultCode(), event.resultCode())
			|| !Objects.equals(
				stored.observedOccupancyStatus(),
				event.occupancyStatus()
			)
			|| !Objects.equals(stored.observedLockStatus(), event.lockStatus())
			|| !Objects.equals(stored.completedAt(), event.occurredAt())) {
			throw new IdempotencyConflictException("eventId", event.eventId());
		}
	}

	private void requireSamePaymentPayload(
		PaymentAttemptRow payment,
		PaymentApproval command
	) {
		if (!payment.tossOrderId().equals(command.tossOrderId())
			|| payment.amount() != command.amount()) {
			throw new IdempotencyConflictException(
				"paymentAttemptId",
				command.paymentAttemptId()
			);
		}
		if (payment.tossPaymentKey() != null
			&& !payment.tossPaymentKey().equals(command.paymentKey())) {
			throw new IdempotencyConflictException(
				"paymentAttemptId",
				command.paymentAttemptId()
			);
		}
	}

	private void validate(ReturnAttemptCommand command) {
		Objects.requireNonNull(command, "command");
		requireText(command.requestId(), "requestId");
		requireText(command.rentalId(), "rentalId");
		if (command.returnSlotId() != null) {
			requireText(command.returnSlotId(), "returnSlotId");
		}
	}

	private void validate(DeviceCommand command) {
		Objects.requireNonNull(command, "command");
		requireText(command.commandId(), "commandId");
		requireText(command.stationId(), "stationId");
		requireText(command.slotId(), "slotId");
		requireText(command.issuedBootId(), "issuedBootId");
		requireText(command.operationType(), "operationType");
	}

	private void validate(DeviceEvent event) {
		Objects.requireNonNull(event, "event");
		requireText(event.eventId(), "eventId");
		requireText(event.commandId(), "commandId");
		requireText(event.bootId(), "bootId");
		requireText(event.slotId(), "slotId");
		requireText(event.occupancyStatus(), "occupancyStatus");
		requireText(event.lockStatus(), "lockStatus");
		Objects.requireNonNull(event.occurredAt(), "occurredAt");
		if (!event.success() && isBlank(event.resultCode())) {
			throw new IllegalArgumentException("Failed event requires resultCode");
		}
	}

	private void validate(PaymentApproval command) {
		Objects.requireNonNull(command, "command");
		requireText(command.paymentAttemptId(), "paymentAttemptId");
		requireText(command.tossOrderId(), "tossOrderId");
		requireText(command.paymentKey(), "paymentKey");
		if (command.amount() < 0) {
			throw new IllegalArgumentException("amount must not be negative");
		}
	}

	private static void requireText(String value, String field) {
		if (isBlank(value)) {
			throw new IllegalArgumentException(field + " must not be blank");
		}
	}

	private static boolean isBlank(String value) {
		return value == null || value.isBlank();
	}

	private static LocalDateTime now() {
		LocalDateTime current = LocalDateTime.now(BUSINESS_ZONE);
		return current.withNano(current.getNano() / 1_000 * 1_000);
	}

	public enum Outcome {
		APPLIED,
		REPLAYED
	}

	public record ReturnAttemptCommand(
		String requestId,
		String rentalId,
		String returnSlotId
	) {
	}

	public record ReturnAttemptResult(
		String returnAttemptId,
		String requestId,
		String status,
		LocalDateTime createdAt,
		Outcome outcome
	) {
	}

	public record DeviceCommand(
		String commandId,
		String stationId,
		String slotId,
		String rentalId,
		String returnAttemptId,
		String issuedBootId,
		String operationType
	) {
	}

	public record DeviceCommandResult(
		String operationId,
		String commandId,
		String status,
		LocalDateTime requestedAt,
		Outcome outcome
	) {
	}

	public record DeviceEvent(
		String eventId,
		String commandId,
		String bootId,
		String slotId,
		String occupancyStatus,
		String lockStatus,
		boolean success,
		String resultCode,
		LocalDateTime occurredAt
	) {
	}

	public record DeviceEventResult(
		String operationId,
		String commandId,
		String eventId,
		String status,
		LocalDateTime completedAt,
		Outcome outcome
	) {
	}

	public record PaymentApproval(
		String paymentAttemptId,
		String tossOrderId,
		String paymentKey,
		long amount
	) {
	}

	public record PaymentApprovalResult(
		String paymentAttemptId,
		String settlementId,
		String paymentKey,
		String status,
		LocalDateTime approvedAt,
		Outcome outcome
	) {
	}
}
