package dev.billisan.rental.dto;

import java.util.UUID;

public record RentalCheckoutResponse(
        UUID rentalId,
        String status,
        String userId,
        String name,
        UUID checkoutSlotId,
        int slotNumber,
        DeviceOperationView deviceOperation) {

    public record DeviceOperationView(String commandId, String operationType, String status) {
    }
}
