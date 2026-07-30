/**
 * TanStack Query 키 대장.
 *
 * 한 곳에 모아 두는 이유는 **무효화** 때문입니다. 명령이 성공하면 관련 조회를 다시 읽어야 하는데
 * (API명세 B-5: "명령 성공 후 관련 조회 캐시를 무효화하고 권위 상세를 재조회한다"),
 * 키가 화면마다 흩어져 있으면 어느 걸 지워야 하는지 알 수 없습니다.
 *
 * 배열 앞쪽이 넓은 범위입니다. `qk.slots.all` 을 무효화하면 그 아래 목록·상세가 전부 갱신됩니다.
 */
export const qk = {
    auth: {
        me: ['auth', 'me'] as const,
    },

    stations: {
        all: ['stations'] as const,
        /** ADMIN-INVENTORY-001 — 대여소 단위 재고 집계 */
        inventory: (stationId: string) => ['stations', stationId, 'inventory'] as const,
    },

    slots: {
        all: ['slots'] as const,
        /** ADMIN-SLOT-001 — 대여소의 슬롯 목록. 필터·커서까지 키에 넣어야 섞이지 않습니다. */
        list: (stationId: string, params: Record<string, unknown>) =>
            ['slots', 'list', stationId, params] as const,
        /** ADMIN-SLOT-DETAIL-001 */
        detail: (slotId: string) => ['slots', 'detail', slotId] as const,
    },

    inspections: {
        all: ['inspections'] as const,
        /** ADMIN-INSPECTION-001 — 전역 목록 */
        list: (params: Record<string, unknown>) => ['inspections', 'list', params] as const,
        /** ADMIN-INSPECTION-002 */
        detail: (inspectionId: string) => ['inspections', 'detail', inspectionId] as const,
    },
} as const;
