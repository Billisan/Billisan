package dev.billisan.settlement.controller;

import dev.billisan.settlement.dto.SettlementPendingResponse;
import dev.billisan.settlement.service.SettlementAppService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class SettlementController {

    private final SettlementAppService settlementAppService;

    public SettlementController(SettlementAppService settlementAppService) {
        this.settlementAppService = settlementAppService;
    }

    @GetMapping("/api/v1/settlements/pending")
    public ResponseEntity<SettlementPendingResponse> getPending(
            @RequestHeader("X-Request-Id") UUID requestId,
            @AuthenticationPrincipal UUID userRef) {
        return ResponseEntity.ok(settlementAppService.pending(userRef));
    }
}
