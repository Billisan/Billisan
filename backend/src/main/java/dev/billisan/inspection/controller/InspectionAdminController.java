package dev.billisan.inspection.controller;

import dev.billisan.global.exception.AdminAccountRequiredException;
import dev.billisan.inspection.domain.DamageInspection.AiResult;
import dev.billisan.inspection.domain.DamageInspection.ReviewStatus;
import dev.billisan.inspection.dto.InspectionDecisionRequest;
import dev.billisan.inspection.dto.InspectionDecisionResult;
import dev.billisan.inspection.dto.InspectionDetailResponse;
import dev.billisan.inspection.dto.InspectionPageResponse;
import dev.billisan.inspection.service.InspectionAdminService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
public class InspectionAdminController {

    private final InspectionAdminService inspectionAdminService;

    public InspectionAdminController(InspectionAdminService inspectionAdminService) {
        this.inspectionAdminService = inspectionAdminService;
    }

    @GetMapping("/api/v1/admin/inspections")
    public ResponseEntity<InspectionPageResponse> list(
            @RequestHeader("X-Request-Id") UUID requestId,
            @RequestParam(required = false) AiResult aiResult,
            @RequestParam(required = false) ReviewStatus reviewStatus,
            @RequestParam(required = false) String modelVersion,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(
                inspectionAdminService.list(aiResult, reviewStatus, modelVersion, from, to, cursor, size));
    }

    @GetMapping("/api/v1/admin/inspections/{inspectionId}")
    public ResponseEntity<InspectionDetailResponse> getDetail(
            @RequestHeader("X-Request-Id") UUID requestId,
            @PathVariable UUID inspectionId) {
        return ResponseEntity.ok(inspectionAdminService.getDetail(inspectionId));
    }

    @PatchMapping("/api/v1/admin/inspections/{inspectionId}/decision")
    public ResponseEntity<InspectionDecisionResult> decide(
            @RequestHeader("X-Request-Id") UUID requestId,
            @PathVariable UUID inspectionId,
            @AuthenticationPrincipal UUID adminId,
            @Valid @RequestBody InspectionDecisionRequest request) {
        if (adminId == null) {
            throw new AdminAccountRequiredException("관리자 인증이 필요합니다.");
        }
        return ResponseEntity.ok(inspectionAdminService.decide(inspectionId, adminId, request));
    }
}
