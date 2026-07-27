/**
 * 운영 처리 대기 건수.
 *
 * 사이드바 배지와 대시보드 바로가기 카드가 같은 값을 봐야 해서 여기 한 곳에 둡니다.
 * TODO: 백엔드 통계 API(GET /admin/summary) 연동되면 TanStack Query 로 교체하세요.
 */
export const OPERATION_SUMMARY = {
    /** 파손 검수 대기 */
    pendingInspections: 5,
    /** 미정산 처리 대기 */
    pendingSettlements: 13,
} as const;
