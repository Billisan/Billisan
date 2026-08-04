import type {
    InspectionDetail,
    InspectionListItem,
    InspectionReviewStatus,
} from '@/features/inspections/types';
import {
    SEED_ADMIN,
    SEED_INSPECTIONS,
    SEED_MODEL_VERSION,
    SEED_STATION,
    SEED_SYNCED_AT,
    seedRentalOfSlot,
    seedSlotOf,
    type SeedInspection,
} from '@/features/stations/mocks/ec2Seed';
import { buildSlots } from '@/features/stations/mocks/slots';
import { decisionInputOf, isInspectionDecided } from '@/features/stations/mocks/slotOverrides';
import { findStation } from '@/features/stations/mocks/stations';
import type { SlotSummary, Station } from '@/features/stations/types';

/**
 * 파손 검수 목업 — **EC2 시드 그대로 3건입니다** (`mocks/ec2Seed.ts`).
 *
 * 슬롯 목업과 **같은 출처**를 봅니다. 따로 만들면 같은 슬롯이 화면마다 다른 상태로 보여서,
 * 예전에 AI 결과와 슬롯 상태가 어긋나 보였던 문제가 되돌아옵니다.
 *
 * **예전에는 슬롯에서 검수를 파생시켰습니다.** `ADMIN_REVIEW` 또는 `DAMAGED` 슬롯이면
 * 검수가 하나 있는 걸로 쳤고, 그래서 36개 슬롯에서 검수가 우수수 생겼습니다. 실제
 * 데이터에는 그런 규칙이 없습니다 — 시드의 슬롯5 는 `ADMIN_REVIEW` 인데 검수가 없고
 * (관리자가 상태만 수동 지정), 슬롯1 은 `AVAILABLE` 인데 검수가 있습니다(정상 판정 완료).
 * 그래서 이제 검수는 슬롯에서 유도하지 않고 시드에 적힌 3건이 전부입니다.
 *
 * TODO: ADMIN-INSPECTION-001 · 002 연동 시 이 파일을 지우세요.
 */

/** 목록 기준 시각 */
export const INSPECTIONS_SYNCED_AT = SEED_SYNCED_AT;

/** 한 번에 받아 오는 건수. 명세 기본값은 20, 최소 1, 최대 100 입니다. */
export const INSPECTION_PAGE_SIZE = 8;

/** 목업 내부에서만 쓰는 원본 묶음. 화면으로는 `item` 만 나갑니다. */
interface InspectionSeed {
    item: InspectionListItem;
    station: Station;
    slot: SlotSummary;
    seed: SeedInspection;
}

/**
 * 시드 검수 3건을 `ADMIN-INSPECTION-001` 의 `items[]` 모양으로 폅니다.
 *
 * `ADMIN-INSPECTION-001` 은 `GET /api/v1/admin/inspections` 로 **전역 목록**입니다.
 * 대여소 범위인 `ADMIN-INVENTORY-001`·`ADMIN-SLOT-001` 과 다릅니다.
 *
 * 기본 정렬은 명세 그대로 **미처리(PENDING) 우선, 같은 상태에서는 `processedAt` 내림차순**입니다.
 * 클라이언트가 다시 정렬하지 않습니다.
 */
function buildInspectionSeeds(): InspectionSeed[] {
    const station = findStation(SEED_STATION.stationId);
    if (!station) return [];

    const slots = buildSlots(station);

    const rows = SEED_INSPECTIONS.flatMap<InspectionSeed>((seed) => {
        const slot = slots.find((row) => row.slotNumber === seed.slotNumber);
        const seedSlot = seedSlotOf(seed.slotNumber);
        if (!slot || !seedSlot) return [];

        // 관리자가 방금 판정했으면 그 결과가 시드값을 이깁니다 (목업 전용 오버라이드).
        const reviewStatus: InspectionReviewStatus = isInspectionDecided(slot.slotId)
            ? 'DECIDED'
            : seed.reviewStatus;

        return [
            {
                station,
                slot,
                seed,
                item: {
                    inspectionId: seed.inspectionId,
                    /*
                     * 이 슬롯으로 들어온 반납 시도.
                     *
                     * 시드 문서에 반납 시도 표가 없어서 대여 행에 붙여 둔 값을 씁니다
                     * (`ec2Seed.ts` 의 `SeedRental.returnAttemptId` 주석 참고).
                     * 반납이 아직 없는 대여(ACTIVE)의 슬롯이면 검수도 없으므로 여기 오지 않습니다.
                     */
                    returnAttemptId: seedRentalOfSlot(seed.slotNumber)?.returnAttemptId ?? '',
                    stationId: station.stationId,
                    slotId: slot.slotId,
                    // 계약 추가 요청분 — 실 응답에는 없어서 api 모듈이 따로 채웁니다.
                    stationName: station.name,
                    slotNumber: slot.slotNumber,
                    aiResult: seed.aiResult,
                    aiScore: seed.aiScore,
                    modelVersion: SEED_MODEL_VERSION,
                    processedAt: seed.processedAt,
                    reviewStatus,
                    updatedAt: slot.updatedAt,
                },
            },
        ];
    });

    return rows.sort((a, b) => {
        // 미처리 우선
        if (a.item.reviewStatus !== b.item.reviewStatus) {
            return a.item.reviewStatus === 'PENDING' ? -1 : 1;
        }
        return b.item.processedAt.localeCompare(a.item.processedAt);
    });
}

/* ------------------------------------------------------------------ 목록 조회 */

/*
 * `NonNullable` 로 감쌉니다. `aiResult` 는 추론이 끝나지 않았으면 `null` 인데,
 * **`null` 은 고를 수 있는 필터 값이 아닙니다** — 드롭다운 선택지에도 없고, 계약 query 의
 * `aiResult` enum(`NORMAL|DAMAGED|UNCERTAIN`)에도 없습니다. 벗기지 않으면 필터 타입이
 * `string | null` 이 되어 `FilterOption<T extends string>` 제약을 못 맞춥니다.
 */
export type AiResultFilter = 'ALL' | NonNullable<InspectionListItem['aiResult']>;
export type ReviewStatusFilter = 'ALL' | InspectionReviewStatus;

export interface InspectionQuery {
    aiResult: AiResultFilter;
    reviewStatus: ReviewStatusFilter;
    /** 'YYYY-MM-DD'. 빈 문자열이면 조건 없음. */
    from: string;
    /** 서버가 주는 불투명 문자열. 클라이언트는 해석하지 않습니다. */
    cursor: string | null;
    size: number;
}

/** `ADMIN-INSPECTION-001` 응답 `data` */
export interface InspectionPage {
    items: InspectionListItem[];
    /** 다음 쪽이 없으면 null. 총 건수·총 페이지 수는 응답에 없습니다. */
    nextCursor: string | null;
}

/**
 * `ADMIN-INSPECTION-001` 을 흉내 냅니다. query 는 계약에 있는 것만 받습니다:
 * `aiResult, reviewStatus, modelVersion, from, to, cursor, size`.
 *
 * 시안에 있던 `반납ID · 대여소 검색` 칸은 뺐습니다. 계약 query 에 키워드 검색이 없습니다.
 */
export function listInspections(query: InspectionQuery): InspectionPage {
    const filtered = buildInspectionSeeds().filter(({ item }) => {
        if (query.aiResult !== 'ALL' && item.aiResult !== query.aiResult) return false;
        if (query.reviewStatus !== 'ALL' && item.reviewStatus !== query.reviewStatus) return false;
        if (query.from && item.processedAt.slice(0, 10) < query.from) return false;
        return true;
    });

    // cursor 는 서버만 해석합니다. 이 목업이 서버 역할이라 여기서만 풀어 씁니다.
    const offset = query.cursor ? Number(query.cursor.replace('c_', '')) : 0;
    const page = filtered.slice(offset, offset + query.size);
    const next = offset + query.size;

    return {
        items: page.map((row) => row.item),
        nextCursor: next < filtered.length ? `c_${next}` : null,
    };
}

/* ------------------------------------------------------------------ 상세 조회 */

/** 판정 목업이 슬롯을 찾을 때 씁니다. 실 API 에는 이런 조회가 필요 없습니다. */
export function slotOfInspection(inspectionId: string): SlotSummary | undefined {
    return buildInspectionSeeds().find((entry) => entry.item.inspectionId === inspectionId)?.slot;
}

/**
 * `ADMIN-INSPECTION-002` 를 흉내 냅니다.
 *
 * 판정값(`decision`)은 **시드에 적힌 값이 기본**이고, 관리자가 화면에서 방금 판정했으면
 * 그 결과를 슬롯 상태에서 되짚습니다. 예전에는 슬롯 품질만 보고 판정을 역산했는데,
 * 시드의 슬롯1 처럼 `AVAILABLE + NORMAL` 인데 판정이 `NORMAL` 로 이미 끝난 건과
 * 아직 판정 전인 건을 구분할 수 없었습니다.
 */
export function findInspection(inspectionId: string | undefined): InspectionDetail | undefined {
    const row = buildInspectionSeeds().find((entry) => entry.item.inspectionId === inspectionId);
    if (!row) return undefined;

    const decided = row.item.reviewStatus === 'DECIDED';
    const input = decisionInputOf(row.slot.slotId);
    // 관리자가 방금 판정한 건이면 슬롯 품질이 그 결과입니다. 아니면 시드값 그대로.
    const decision = !decided
        ? null
        : (row.seed.decision ??
          (row.slot.itemCondition === 'DAMAGED' || row.slot.itemCondition === 'REPAIRABLE'
              ? 'DAMAGED'
              : 'NORMAL'));

    return {
        ...row.item,
        rentalId: seedRentalOfSlot(row.slot.slotNumber)?.rentalId ?? '',
        decision,
        decisionReasonCode: decided ? input.reasonCode : null,
        decisionNote: decided ? input.note : null,
        decidedBy: decided ? SEED_ADMIN.adminId : null,
        decidedAt: decided ? row.slot.updatedAt : null,
        slotOccupancyStatus: row.slot.occupancyStatus,
        slotItemCondition: row.slot.itemCondition,
        slotServiceStatus: row.slot.serviceStatus,
        slotLockStatus: row.slot.lockStatus,
    };
}
