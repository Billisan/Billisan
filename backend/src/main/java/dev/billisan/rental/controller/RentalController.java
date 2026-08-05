package dev.billisan.rental.controller;

import tools.jackson.databind.node.NullNode;
import dev.billisan.rental.dto.RentalCurrentResponse;
import dev.billisan.rental.dto.RentalHistoryResponse;
import dev.billisan.rental.service.RentalAppService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class RentalController {

    private final RentalAppService rentalAppService;

    public RentalController(RentalAppService rentalAppService) {
        this.rentalAppService = rentalAppService;
    }

    /**
     * 12-R RENTAL-001 — "활성 대여가 없으면 HTTP 200과 data:null". Java {@code null}을 그대로
     * 반환하면 Spring MVC가 바디 자체를 쓰지 않아(204에 가까운 빈 바디) 봉투 없는 계약에서
     * "리터럴 null"을 표현할 수 없다 — {@link NullNode}(Jackson이 실제로 null을 직렬화하는
     * 논-null 객체)로 감싸 우회한다.
     */
    @GetMapping("/api/v1/rentals/current")
    public ResponseEntity<Object> getCurrent(
            @RequestHeader("X-Request-Id") UUID requestId,
            @AuthenticationPrincipal UUID userRef) {
        RentalCurrentResponse response = rentalAppService.current(userRef);
        return ResponseEntity.ok(response != null ? response : NullNode.getInstance());
    }

    @GetMapping("/api/v1/rentals")
    public ResponseEntity<RentalHistoryResponse> getHistory(
            @RequestHeader("X-Request-Id") UUID requestId,
            @AuthenticationPrincipal UUID userRef,
            @RequestParam(required = false, defaultValue = "ALL") String status,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(rentalAppService.history(userRef, status, cursor, size));
    }
}
