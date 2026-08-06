package dev.billisan.user.dto;

import java.util.UUID;

/** EDGE-AUTH-001 요청 — authRequestId는 재전송 시 로깅 중복 방지용 상관관계 키일 뿐, 조회 자체는 멱등하다. */
public record AuthResultRequest(UUID authRequestId, UUID sessionId, UUID stationId, UUID userRef) {
}
