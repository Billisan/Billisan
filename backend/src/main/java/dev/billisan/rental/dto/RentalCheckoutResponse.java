package dev.billisan.rental.dto;

import java.util.UUID;

public record RentalCheckoutResponse(
        UUID rentalId,
        String status,
        UUID checkoutSlotId,
        int slotNumber,
        DeviceOperationView deviceOperation) {

    public record DeviceOperationView(UUID commandId, String operationType, String status) {
    }
}
