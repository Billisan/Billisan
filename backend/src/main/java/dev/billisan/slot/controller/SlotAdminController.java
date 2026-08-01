package dev.billisan.slot.controller;

import dev.billisan.slot.dto.SlotDetailResponse;
import dev.billisan.slot.dto.SlotInventoryResponse;
import dev.billisan.slot.dto.SlotListResponse;
import dev.billisan.slot.dto.SlotStatusUpdateRequest;
import dev.billisan.slot.dto.SlotSummaryResponse;
import dev.billisan.slot.service.SlotAdminService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class SlotAdminController {

    private final SlotAdminService slotAdminService;

    public SlotAdminController(SlotAdminService slotAdminService) {
        this.slotAdminService = slotAdminService;
    }

    @GetMapping("/api/v1/admin/stations/{stationId}/inventory")
    public ResponseEntity<SlotInventoryResponse> getInventory(
            @RequestHeader("X-Request-Id") UUID requestId,
            @PathVariable UUID stationId) {
        return ResponseEntity.ok(slotAdminService.getInventory(stationId));
    }

    @GetMapping("/api/v1/admin/stations/{stationId}/slots")
    public ResponseEntity<SlotListResponse> listSlots(
            @RequestHeader("X-Request-Id") UUID requestId,
            @PathVariable UUID stationId) {
        return ResponseEntity.ok(slotAdminService.listSlots(stationId));
    }

    @GetMapping("/api/v1/admin/slots/{slotId}")
    public ResponseEntity<SlotDetailResponse> getSlotDetail(
            @RequestHeader("X-Request-Id") UUID requestId,
            @PathVariable UUID slotId) {
        return ResponseEntity.ok(slotAdminService.getSlotDetail(slotId));
    }

    @PatchMapping("/api/v1/admin/slots/{slotId}/status")
    public ResponseEntity<SlotSummaryResponse> updateStatus(
            @RequestHeader("X-Request-Id") UUID requestId,
            @PathVariable UUID slotId,
            @Valid @RequestBody SlotStatusUpdateRequest request) {
        return ResponseEntity.ok(slotAdminService.updateStatus(slotId, request));
    }
}
