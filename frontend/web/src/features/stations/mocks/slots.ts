import {
    SEED_SLOTS,
    SEED_STATION,
    SEED_SYNCED_AT,
    seedInspectionOfSlot,
} from '@/features/stations/mocks/ec2Seed';
import { applyOverride } from '@/features/stations/mocks/slotOverrides';
import type { SlotSummary, Station } from '@/features/stations/types';

/**
 * 슬롯 목업 — `ADMIN-SLOT-001` 의 `items[]` 모양. **EC2 시드 그대로입니다.**
 *
 * 응답에 있는 필드만 만듭니다: `slotId, slotNumber, occupancyStatus, itemCondition,
 * serviceStatus, lockStatus, updatedAt`. 활성 대여도 검수 요약도 목록에는 없습니다.
 *
 * **예전에는 상태를 순환 패턴으로 지어냈습니다.** 대여소마다 시작 위치를 어긋나게 해서
 * 36개 슬롯을 채웠고, 어느 슬롯이 무슨 상태인지는 해시가 정했습니다. 화면을 채우는 데는
 * 좋았지만 실 데이터와 아무 관계가 없어서, 실 API 로 갈아타는 순간 전부 달라졌습니다.
 *
 * 지금은 슬롯 5개가 `ec2Seed.ts` 에 **명시적으로** 적혀 있습니다. 상태를 바꾸고 싶으면
 * 그 파일을 고치세요 — 여기에는 생성 규칙이 없습니다.
 *
 * TODO: ADMIN-SLOT-001 연동 시 이 파일을 지우세요.
 */

/** 상세 화면 상단에 표시하는 최근 통신 시각 */
export const STATION_SYNCED_AT = SEED_SYNCED_AT;

/**
 * 이 슬롯에 걸린 검수의 처리 상태. 검수가 없는 슬롯이면 `null`.
 *
 * 목록 응답에는 없고 상세·검수 API 에서만 씁니다.
 *
 * **`ADMIN_REVIEW` 라고 검수가 있는 게 아닙니다.** 시드의 슬롯5 가 그 예입니다 —
 * 관리자가 검수를 거치지 않고 슬롯 상태만 「수리 가능」으로 직접 지정했습니다.
 * 예전 목업은 `ADMIN_REVIEW` 면 검수를 자동으로 만들어 붙였는데, 실제 데이터에는
 * 그런 규칙이 없어서 있지도 않은 검수로 이동하는 링크가 생겼습니다.
 */
export function inspectionStateOf(
    _station: Station,
    slotNumber: number,
): 'PENDING' | 'DECIDED' | null {
    return seedInspectionOfSlot(slotNumber)?.reviewStatus ?? null;
}

/**
 * 시드 슬롯을 `ADMIN-SLOT-001` 응답 모양으로 폅니다.
 *
 * `station` 인자는 남겨 뒀습니다 — 대여소 목록 API 가 들어오면 대여소가 여럿이 될 수 있고,
 * 그때 호출부를 다시 손대지 않기 위해서입니다. 지금은 시드 대여소 하나뿐이라 다른
 * 대여소로 물으면 빈 배열입니다 (없는 대여소에 슬롯을 지어내지 않습니다).
 */
export function buildSlots(station: Station): SlotSummary[] {
    if (station.stationId !== SEED_STATION.stationId) return [];

    return SEED_SLOTS.map((seed) =>
        // 관리자가 방금 바꾼 슬롯이면 그 결과로 덮어씁니다. 목업 전용이라 새로고침하면 사라집니다.
        applyOverride({
            slotId: seed.slotId,
            slotNumber: seed.slotNumber,
            occupancyStatus: seed.occupancyStatus,
            serviceStatus: seed.serviceStatus,
            itemCondition: seed.itemCondition,
            lockStatus: seed.lockStatus,
            // 서버 계약과 같은 DATETIME(6) 형태로 둡니다. 표시할 때만 잘라 씁니다.
            updatedAt: seed.updatedAt,
        }),
    );
}
