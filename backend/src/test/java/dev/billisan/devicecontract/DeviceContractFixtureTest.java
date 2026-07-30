package dev.billisan.devicecontract;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeviceContractFixtureTest {

	private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

	private static final Set<String> RETURN_ATTEMPT_STATUSES = Set.of(
		"PROCESSING",
		"PHYSICAL_DONE",
		"COMPLETED",
		"RECOVERY_REQUIRED",
		"FAILED"
	);

	private static final Set<String> FORBIDDEN_FIELDS = Set.of(
		"process_status",
		"processStatus",
		"image",
		"imageBase64",
		"imagePath",
		"imageUrl",
		"faceImage",
		"embedding",
		"faceEmbedding"
	);

	@ParameterizedTest(name = "{0}")
	@MethodSource("requestFixtures")
	void validatesEveryRequestFixture(String file, ContractType contractType) throws IOException {
		JsonNode fixture = readFixture(file);

		validateNoForbiddenFields(fixture);
		switch (contractType) {
			case FACE_AUTH -> validateFaceAuth(fixture);
			case DAMAGE_RESULT -> validateDamageResult(fixture);
			case DEVICE_EVENT -> validateDeviceEvent(fixture);
			case HEARTBEAT -> validateHeartbeat(fixture);
			case BOOT_SNAPSHOT -> validateBootSnapshot(fixture);
		}
	}

	@Test
	void reproducesMatchingAndMismatchingBootSnapshots() throws IOException {
		Map<String, PhysicalState> serverBaseline = physicalStates(
			readFixture("boot-snapshot-server-baseline.json")
		);
		Map<String, PhysicalState> matchingSnapshot = physicalStates(
			readFixture("boot-snapshot-match.json")
		);
		Map<String, PhysicalState> mismatchingSnapshot = physicalStates(
			readFixture("boot-snapshot-mismatch.json")
		);

		assertEquals(serverBaseline, matchingSnapshot);
		assertEquals(1, mismatchCount(serverBaseline, mismatchingSnapshot));
	}

	@Test
	void rejectsMissingAndMalformedIdentifiers() throws IOException {
		ObjectNode missingAuthRequestId = readObjectFixture("face-auth-success.json");
		missingAuthRequestId.remove("authRequestId");
		assertThrows(
			IllegalArgumentException.class,
			() -> validateFaceAuth(missingAuthRequestId)
		);

		ObjectNode malformedStationId = readObjectFixture("face-auth-success.json");
		malformedStationId.put("stationId", "not-a-uuid");
		assertThrows(
			IllegalArgumentException.class,
			() -> validateFaceAuth(malformedStationId)
		);

		ObjectNode missingEventId = readObjectFixture("lock-success.json");
		missingEventId.remove("eventId");
		assertThrows(
			IllegalArgumentException.class,
			() -> validateDeviceEvent(missingEventId)
		);
	}

	@Test
	void rejectsForbiddenBiometricAndLegacyStatusFields() throws IOException {
		ObjectNode withEmbedding = readObjectFixture("face-auth-success.json");
		((ObjectNode) withEmbedding.get("faceResult")).put("embedding", "[mock-vector]");
		assertThrows(
			IllegalArgumentException.class,
			() -> validateNoForbiddenFields(withEmbedding)
		);

		ObjectNode withImage = readObjectFixture("damage-result.json");
		withImage.put("imageBase64", "not-real-image-data");
		assertThrows(
			IllegalArgumentException.class,
			() -> validateNoForbiddenFields(withImage)
		);

		ObjectNode withLegacyStatus = readObjectFixture("damage-result.json");
		withLegacyStatus.put("processStatus", "COMPLETED");
		assertThrows(
			IllegalArgumentException.class,
			() -> validateNoForbiddenFields(withLegacyStatus)
		);
	}

	@Test
	void keepsTracingRequestAndDomainIdempotencyKeysSeparate() throws IOException {
		String httpRequests = readResource("/device-contract/device-gateway.http");

		assertTrue(httpRequests.contains("X-Request-Id:"));
		assertTrue(httpRequests.contains("Idempotency-Key:"));
		assertFalse(httpRequests.contains(
			"X-Request-Id: 91000000-0000-0000-0000-000000000001"
		));
		assertFalse(httpRequests.contains(
			"X-Request-Id: a1000000-0000-0000-0000-000000000001"
		));
	}

	@Test
	void usesConfirmedPiToSpringEdgeEndpoints() throws IOException {
		String httpRequests = readResource("/device-contract/device-gateway.http");

		assertTrue(httpRequests.contains("POST {{baseUrl}}/api/v1/edge/kiosk-authentications"));
		assertTrue(httpRequests.contains(
			"POST {{baseUrl}}/api/v1/edge/return-attempts/"
				+ "{{returnAttemptId}}/inspection-results"
		));
		assertTrue(httpRequests.contains(
			"POST {{baseUrl}}/api/v1/edge/device-operations/"
		));
		assertTrue(httpRequests.contains(
			"POST {{baseUrl}}/api/v1/edge/stations/{{stationId}}/heartbeats"
		));
		assertTrue(httpRequests.contains(
			"POST {{baseUrl}}/api/v1/edge/stations/{{stationId}}/boot-snapshots"
		));
	}

	private static Stream<Arguments> requestFixtures() {
		return Stream.of(
			Arguments.of("face-auth-success.json", ContractType.FACE_AUTH),
			Arguments.of("face-auth-failure.json", ContractType.FACE_AUTH),
			Arguments.of("damage-result.json", ContractType.DAMAGE_RESULT),
			Arguments.of("slot-sensor-occupied.json", ContractType.DEVICE_EVENT),
			Arguments.of("slot-sensor-empty.json", ContractType.DEVICE_EVENT),
			Arguments.of("lock-success.json", ContractType.DEVICE_EVENT),
			Arguments.of("lock-failure.json", ContractType.DEVICE_EVENT),
			Arguments.of("heartbeat-normal.json", ContractType.HEARTBEAT),
			Arguments.of("boot-snapshot-match.json", ContractType.BOOT_SNAPSHOT),
			Arguments.of("boot-snapshot-mismatch.json", ContractType.BOOT_SNAPSHOT),
			Arguments.of("boot-snapshot-lock-mismatch.json", ContractType.BOOT_SNAPSHOT),
			Arguments.of("boot-snapshot-unknown-slot.json", ContractType.BOOT_SNAPSHOT),
			Arguments.of("boot-snapshot-partial.json", ContractType.BOOT_SNAPSHOT)
		);
	}

	private static void validateFaceAuth(JsonNode fixture) {
		requireUuid(fixture, "sessionId");
		requireUuid(fixture, "authRequestId");
		requireUuid(fixture, "stationId");
		requireUuid(fixture, "deviceId");
		requireEnum(fixture, "mode", Set.of("RENT", "RETURN"));

		JsonNode faceResult = requireObject(fixture, "faceResult");
		JsonNode matched = faceResult.get("matched");
		if (matched == null || !matched.isBoolean()) {
			throw new IllegalArgumentException("faceResult.matched must be boolean");
		}

		if (matched.booleanValue()) {
			requireUuid(faceResult, "userId");
		} else if (!faceResult.path("userId").isNull()) {
			throw new IllegalArgumentException("failed face result must not identify a user");
		}

		requireRange(faceResult, "similarity", 0, 1);
		requireText(faceResult, "modelVersion");
	}

	private static void validateDamageResult(JsonNode fixture) {
		requireUuid(fixture, "inspectionRequestId");
		requireEnum(fixture, "status", RETURN_ATTEMPT_STATUSES);
		requireEnum(
			fixture,
			"result",
			Set.of("NORMAL", "DAMAGED", "UNCERTAIN", "FAILED")
		);
		requireRange(fixture, "confidence", 0, 1);
		requireText(fixture, "modelVersion");
		assertNotEquals("UNDECIDED", requireText(fixture, "inferenceNode"));
	}

	private static void validateDeviceEvent(JsonNode fixture) {
		requireUuid(fixture, "eventId");
		requireUuid(fixture, "commandId");
		requireUuid(fixture, "bootId");
		requireEnum(
			fixture,
			"eventType",
			Set.of(
				"OPERATION_COMPLETED",
				"OPERATION_FAILED"
			)
		);
		if (!fixture.path("evidenceSchemaVersion").canConvertToInt()
			|| fixture.path("evidenceSchemaVersion").intValue() < 1) {
			throw new IllegalArgumentException(
				"evidenceSchemaVersion must be positive"
			);
		}
		requireOffsetDateTime(fixture, "occurredAt");
		requireUuid(fixture, "slotId");
		requireNullableUuid(fixture, "rentalId");
		requireNullableUuid(fixture, "returnAttemptId");

		JsonNode physicalState = requireObject(fixture, "physicalState");
		requireEnum(
			physicalState,
			"occupancyStatus",
			Set.of("EMPTY", "OCCUPIED", "UNKNOWN")
		);
		requireEnum(
			physicalState,
			"lockStatus",
			Set.of("LOCKED", "UNLOCKED", "UNKNOWN", "ERROR")
		);

		JsonNode success = fixture.get("success");
		if (success == null || !success.isBoolean()) {
			throw new IllegalArgumentException("success must be boolean");
		}
		if (!success.booleanValue() && fixture.path("errorCode").isNull()) {
			throw new IllegalArgumentException("failed device event requires errorCode");
		}
		String expectedEventType = success.booleanValue()
			? "OPERATION_COMPLETED"
			: "OPERATION_FAILED";
		if (!expectedEventType.equals(fixture.path("eventType").asString())) {
			throw new IllegalArgumentException(
				"terminal event type does not match success"
			);
		}
	}

	private static void validateHeartbeat(JsonNode fixture) {
		requireUuid(fixture, "eventId");
		requireUuid(fixture, "deviceId");
		requireOffsetDateTime(fixture, "measuredAt");
	}

	private static void validateBootSnapshot(JsonNode fixture) {
		requireUuid(fixture, "bootId");
		requireUuid(fixture, "deviceId");
		requireOffsetDateTime(fixture, "measuredAt");

		JsonNode slots = fixture.get("slots");
		if (slots == null || !slots.isArray() || slots.isEmpty()) {
			throw new IllegalArgumentException("snapshot slots must not be empty");
		}

		Set<String> slotIds = new HashSet<>();
		for (JsonNode slot : slots) {
			String slotId = requireUuid(slot, "slotId");
			if (!slotIds.add(slotId)) {
				throw new IllegalArgumentException("snapshot contains duplicate slotId");
			}
			if (!slot.path("slotNumber").canConvertToInt()
				|| slot.path("slotNumber").intValue() < 1) {
				throw new IllegalArgumentException("slotNumber must be positive");
			}
			requireEnum(
				slot,
				"occupancyStatus",
				Set.of("EMPTY", "OCCUPIED", "UNKNOWN")
			);
			requireEnum(
				slot,
				"lockStatus",
				Set.of("LOCKED", "UNLOCKED", "UNKNOWN", "ERROR")
			);
			requireEnum(slot, "sensorHealth", Set.of("NORMAL", "DEGRADED", "ERROR"));
		}
	}

	private static void validateNoForbiddenFields(JsonNode node) {
		if (node.isObject()) {
			for (Map.Entry<String, JsonNode> property : node.properties()) {
				if (FORBIDDEN_FIELDS.contains(property.getKey())) {
					throw new IllegalArgumentException(
						"forbidden contract field: " + property.getKey()
					);
				}
				validateNoForbiddenFields(property.getValue());
			}
		} else if (node.isArray()) {
			node.forEach(DeviceContractFixtureTest::validateNoForbiddenFields);
		}
	}

	private static Map<String, PhysicalState> physicalStates(JsonNode fixture) {
		Map<String, PhysicalState> states = new HashMap<>();
		for (JsonNode slot : fixture.path("slots")) {
			String slotId = requireUuid(slot, "slotId");
			PhysicalState previous = states.put(
				slotId,
				new PhysicalState(
					requireText(slot, "occupancyStatus"),
					requireText(slot, "lockStatus")
				)
			);
			if (previous != null) {
				throw new IllegalArgumentException("duplicate slotId: " + slotId);
			}
		}
		return states;
	}

	private static int mismatchCount(
		Map<String, PhysicalState> expected,
		Map<String, PhysicalState> actual
	) {
		Set<String> allSlotIds = new HashSet<>(expected.keySet());
		allSlotIds.addAll(actual.keySet());
		return (int) allSlotIds.stream()
			.filter(slotId -> !Objects.equals(expected.get(slotId), actual.get(slotId)))
			.count();
	}

	private static JsonNode requireObject(JsonNode parent, String field) {
		JsonNode value = parent.get(field);
		if (value == null || !value.isObject()) {
			throw new IllegalArgumentException(field + " must be object");
		}
		return value;
	}

	private static String requireText(JsonNode parent, String field) {
		JsonNode value = parent.get(field);
		if (value == null || !value.isString() || value.asString().isBlank()) {
			throw new IllegalArgumentException(field + " must be non-empty text");
		}
		return value.asString();
	}

	private static String requireUuid(JsonNode parent, String field) {
		String value = requireText(parent, field);
		try {
			String normalized = UUID.fromString(value).toString();
			if (!normalized.equals(value)) {
				throw new IllegalArgumentException(field + " must use canonical lowercase UUID");
			}
			return normalized;
		} catch (IllegalArgumentException exception) {
			throw new IllegalArgumentException(field + " must be UUID", exception);
		}
	}

	private static void requireNullableUuid(JsonNode parent, String field) {
		JsonNode value = parent.get(field);
		if (value == null) {
			throw new IllegalArgumentException(field + " must be present");
		}
		if (!value.isNull()) {
			requireUuid(parent, field);
		}
	}

	private static void requireEnum(JsonNode parent, String field, Set<String> allowed) {
		String value = requireText(parent, field);
		if (!allowed.contains(value)) {
			throw new IllegalArgumentException(field + " has unsupported value: " + value);
		}
	}

	private static void requireRange(
		JsonNode parent,
		String field,
		double minimum,
		double maximum
	) {
		JsonNode value = parent.get(field);
		if (value == null
			|| !value.isNumber()
			|| value.doubleValue() < minimum
			|| value.doubleValue() > maximum) {
			throw new IllegalArgumentException(field + " is outside its allowed range");
		}
	}

	private static void requireOffsetDateTime(JsonNode parent, String field) {
		String value = requireText(parent, field);
		try {
			OffsetDateTime.parse(value);
		} catch (RuntimeException exception) {
			throw new IllegalArgumentException(field + " must be ISO-8601 offset date-time");
		}
	}

	private static JsonNode readFixture(String file) throws IOException {
		return OBJECT_MAPPER.readTree(
			requireResource("/device-contract/v1/" + file)
		);
	}

	private static ObjectNode readObjectFixture(String file) throws IOException {
		JsonNode fixture = readFixture(file);
		if (!(fixture instanceof ObjectNode objectFixture)) {
			throw new IllegalArgumentException("fixture root must be object: " + file);
		}
		return objectFixture.deepCopy();
	}

	private static String readResource(String path) throws IOException {
		try (InputStream input = requireResource(path)) {
			return new String(input.readAllBytes(), StandardCharsets.UTF_8);
		}
	}

	private static InputStream requireResource(String path) {
		InputStream input = DeviceContractFixtureTest.class.getResourceAsStream(path);
		if (input == null) {
			throw new IllegalArgumentException("missing test resource: " + path);
		}
		return input;
	}

	private enum ContractType {
		FACE_AUTH,
		DAMAGE_RESULT,
		DEVICE_EVENT,
		HEARTBEAT,
		BOOT_SNAPSHOT
	}

	private record PhysicalState(String occupancyStatus, String lockStatus) {
	}
}
