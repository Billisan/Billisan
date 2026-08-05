package dev.billisan.alert.controller;

import dev.billisan.alert.dto.AlertListResponse;
import dev.billisan.alert.service.AlertService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping("/api/v1/app/alerts")
    public ResponseEntity<AlertListResponse> getAlerts(
            @RequestHeader("X-Request-Id") UUID requestId,
            @AuthenticationPrincipal UUID userRef) {
        return ResponseEntity.ok(alertService.list(userRef));
    }
}
