package dev.billisan.inspection.dto;

import java.util.List;

/**
 * ⚠️ 초안 단순화: {@code nextCursor}는 진짜 keyset 커서가 아니라 "그룹:오프셋"을 base64로
 * 인코딩한 값이다(예: {@code PENDING:20}). 클라이언트 입장에선 여전히 불투명한 문자열이라
 * API 계약(cursor는 opaque)은 지킨다. 동시 편집이 잦아지면 진짜 keyset으로 바꿔야 한다.
 */
public record InspectionPageResponse(
        List<InspectionSummaryResponse> items,
        String nextCursor
) {
}
