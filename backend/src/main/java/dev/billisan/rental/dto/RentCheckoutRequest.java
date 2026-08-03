package dev.billisan.rental.dto;

import java.util.UUID;

public record RentCheckoutRequest(UUID rentalRequestId, UUID sessionId, UUID stationId, UUID userRef) {
}
