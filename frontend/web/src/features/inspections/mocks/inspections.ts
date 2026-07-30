import { MOCK_RETURNS } from '@/features/history/mocks/history';
import { MODEL_VERSION, aiResultOf, aiScoreOf } from '@/features/inspections/mocks/aiVerdict';
import type {
    InspectionDetail,
    InspectionListItem,
    InspectionReviewStatus,
} from '@/features/inspections/types';
import { MOCK_NS, mockUuid } from '@/features/stations/mocks/ids';
import { buildSlots, inspectionStateOf, slotSeq } from '@/features/stations/mocks/slots';
import { decisionInputOf, isInspectionDecided } from '@/features/stations/mocks/slotOverrides';
import { listStations } from '@/features/stations/mocks/stations';
import type { SlotSummary, Station } from '@/features/stations/types';

/**
 * 파손 검수 목업.
 *
 * 대여소 상세·슬롯 상세와 **같은 슬롯 목업에서 파생**시킵니다. 따로 만들면 같은 슬롯이
 * 화면마다 다른 상태로 보여서, 예전에 AI 결과와 슬롯 상태가 어긋나 보였던 문제가 되돌아옵니다.
 *
 * TODO: ADMIN-INSPECTION-001 · 002 연동 시 이 파일을 지우세요.
 */

/** 목록 기준 시각. 시안 상단의 '2026-07-24 09:20 기준' 값입니다. */
export const INSPECTIONS_SYNCED_AT = '2026-07-24 09:20';

/** 한 번에 받아 오는 건수. 명세 기본값은 20, 최소 1, 최대 100 입니다. */
export const INSPECTION_PAGE_SIZE = 8;

/**
 * 목업 표시용 시각 계산.
 *
 * 슬롯의 `updatedAt` **원문은 이 함수를 통과시키지 않습니다**. 그 값은 CAS 로 그대로
 * 왕복해야 하고, Date 로 파싱했다가 다시 만들면 마이크로초가 잘립니다.
 */
function shiftMinutes(at: string, minutes: number): string {
    const [date, rest] = at.split('T');
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = rest.slice(0, 5).split(':').map(Number);
    // UTC 로 계산해야 로컬 타임존이 끼어들어 날짜가 밀리지 않습니다.
    const shifted = new Date(Date.UTC(y, m - 1, d, hh, mm - minutes));
    const pad = (value: number) => String(value).padStart(2, '0');

    return (
        `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
        `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:00.000000+09:00`
    );
}

/**
 * 이 슬롯으로 들어온 반납 시도.
 *
 * 이력 목업이 슬롯을 **모양으로 요청**해서 배정받으므로, 같은 슬롯을 여기서 되짚으면
 * 검수 ↔ 반납이 양방향으로 이어집니다. 이력에 그 슬롯을 쓴 반납이 없으면 `undefined`.
 */
function returnAttemptOfSlot(slotId: string): string | undefined {
    return MOCK_RETURNS.find((attempt) => attempt.slotId === slotId)?.returnAttemptId;
}

/** 목업 내부에서만 쓰는 원본 묶음. 화면으로는 `item` 만 나갑니다. */
interface InspectionSeed {
    item: InspectionListItem;
    station: Station;
    slot: SlotSummary;
}

/**
 * 전체 대여소의 검수를 한 줄로 폅니다.
 *
 * `ADMIN-INSPECTION-001` 은 `GET /api/v1/admin/inspections` 로 **전역 목록**입니다.
 * 대여소 범위인 `ADMIN-INVENTORY-001`·`ADMIN-SLOT-001` 과 다릅니다.
 *
 * 기본 정렬은 명세 그대로 **미처리(PENDING) 우선, 같은 상태에서는 `processedAt` 내림차순**입니다.
 */
function buildInspectionSeeds(): InspectionSeed[] {
    const rows: InspectionSeed[] = [];

    listStations().forEach((station, stationIndex) => {
        buildSlots(station).forEach((slot, slotIndex) => {
            const seeded = inspectionStateOf(station, slot.slotNumber);
            if (!seeded) return;

            // 관리자가 방금 판정했으면 그 결과가 우선입니다.
            const reviewStatus: InspectionReviewStatus = isInspectionDecided(slot.slotId)
                ? 'DECIDED'
                : seeded;
            const decided = reviewStatus === 'DECIDED';

            // 검수는 슬롯이 마지막으로 갱신되기 전에 끝나 있습니다. 대여소·슬롯마다 어긋나게
            // 밀어서 같은 시각이 겹쳐 보이지 않게 합니다.
            const processedAt = shiftMinutes(
                slot.updatedAt,
                9 + stationIndex * 47 + slotIndex * 23,
            );

            rows.push({
                station,
                slot,
                item: {
                    inspectionId: mockUuid(MOCK_NS.inspection, slotSeq(station, slot.slotNumber)),
                    /*
                     * 이 슬롯으로 들어온 반납이 이력에 있으면 그 UUID 를 씁니다.
                     *
                     * 예전에는 늘 `mockUuid(returnAttempt, slotSeq(...))` 를 만들어 넣었는데,
                     * 반납 이력에 그런 반납은 없어서 검수 목록·상세의 '반납 ID' 가 어디에도
                     * 없는 값이었습니다. 화면에 링크가 아니라 축약 표시로만 나가서 눌러
                     * 볼 수도 없었고요.
                     */
                    returnAttemptId:
                        returnAttemptOfSlot(slot.slotId) ??
                        mockUuid(MOCK_NS.returnAttempt, slotSeq(station, slot.slotNumber)),
                    stationId: station.stationId,
                    slotId: slot.slotId,
                    // 계약 추가 요청분. 서버가 채워 주면 목업의 이 두 줄만 지우면 됩니다.
                    stationName: station.name,
                    slotNumber: slot.slotNumber,
                    aiResult: aiResultOf(slot, decided),
                    aiScore: aiScoreOf(slot, decided),
                    modelVersion: MODEL_VERSION,
                    processedAt,
                    reviewStatus,
                    updatedAt: slot.updatedAt,
                },
            });
        });
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

export type AiResultFilter = 'ALL' | InspectionListItem['aiResult'];
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

/** `ADMIN-INSPECTION-002` 를 흉내 냅니다. */
export function findInspection(inspectionId: string | undefined): InspectionDetail | undefined {
    const row = buildInspectionSeeds().find((entry) => entry.item.inspectionId === inspectionId);
    if (!row) return undefined;

    const decided = row.item.reviewStatus === 'DECIDED';
    const input = decisionInputOf(row.slot.slotId);
    const damaged = row.slot.itemCondition === 'DAMAGED' || row.slot.itemCondition === 'REPAIRABLE';

    return {
        ...row.item,
        rentalId: mockUuid(MOCK_NS.rental, slotSeq(row.station, row.slot.slotNumber)),
        decision: decided ? (damaged ? 'DAMAGED' : 'NORMAL') : null,
        decisionReasonCode: decided ? input.reasonCode : null,
        decisionNote: decided ? input.note : null,
        decidedBy: decided ? mockUuid(MOCK_NS.station, 1) : null,
        decidedAt: decided ? row.slot.updatedAt : null,
        slotOccupancyStatus: row.slot.occupancyStatus,
        slotItemCondition: row.slot.itemCondition,
        slotServiceStatus: row.slot.serviceStatus,
        slotLockStatus: row.slot.lockStatus,
    };
}
