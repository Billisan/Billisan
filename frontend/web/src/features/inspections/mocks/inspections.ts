import { aiResultOf, aiScoreOf } from '@/features/inspections/mocks/aiVerdict';
import type {
    InspectionDetail,
    InspectionListItem,
    InspectionReviewStatus,
} from '@/features/inspections/types';
import { buildSlots } from '@/features/stations/mocks/slots';
import { MOCK_STATIONS } from '@/features/stations/mocks/stations';
import { outcomeOf } from '@/features/stations/mocks/slotOverrides';
import type { AiInspectionResult, Slot, Station } from '@/features/stations/types';

/**
 * 파손 검수 목업.
 *
 * 대여소 상세·슬롯 상세와 **같은 슬롯 목업에서 파생**시킵니다. 따로 만들면 같은 슬롯이
 * 화면마다 다른 상태로 보여서, 예전에 AI 결과와 슬롯 상태가 어긋나 보였던 문제가 되돌아옵니다.
 *
 * TODO: ADMIN-INSPECTION-001 · 002 연동 시 이 파일을 지우고 TanStack Query 로 교체하세요.
 */

/** 목록 기준 시각. 시안 상단의 '2026-07-24 09:20 기준' 값입니다. */
export const INSPECTIONS_SYNCED_AT = '2026-07-24 09:20';

/** 한 번에 받아 오는 건수 (`ADMIN-INSPECTION-001` 의 `size`). */
export const INSPECTION_PAGE_SIZE = 8;

/** Orin 추론 모델. `EDGE-INSPECT-001` 예시의 `modelVersion` 값입니다. */
const MODEL_VERSION = 'damage-model-v1';

/**
 * 목업 표시용 시각 계산.
 *
 * 슬롯의 `updatedAt` **원문은 이 함수를 통과시키지 않습니다**. 그 값은 CAS 로 그대로
 * 왕복해야 하고, Date 로 파싱했다가 다시 만들면 마이크로초가 잘립니다 (API명세 B-5).
 * 여기서 만드는 건 화면에 찍을 `processedAt` 뿐입니다.
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

export interface InspectionRow {
    item: InspectionListItem;
    station: Station;
    slot: Slot;
}

/**
 * 전체 대여소의 검수를 한 줄로 폅니다.
 *
 * `ADMIN-INSPECTION-001` 은 `GET /api/v1/admin/inspections` 로 **전역 목록**입니다.
 * 대여소 범위인 `ADMIN-INVENTORY-001`·`ADMIN-SLOT-001` 과 달라서, 여러 대여소가
 * 섞인 목록을 만들 수 있습니다.
 */
export function buildInspectionRows(): InspectionRow[] {
    const rows: InspectionRow[] = [];

    MOCK_STATIONS.forEach((station, stationIndex) => {
        buildSlots(station).forEach((slot, slotIndex) => {
            if (!slot.inspection) return;

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
                    inspectionId: slot.inspection.inspectionId,
                    returnAttemptId: returnAttemptIdOf(slot),
                    stationId: station.stationId,
                    slotId: slot.slotId,
                    aiResult: aiResultOf(slot),
                    aiScore: aiScoreOf(slot),
                    modelVersion: MODEL_VERSION,
                    processedAt,
                    reviewStatus: slot.inspection.reviewStatus,
                    updatedAt: slot.updatedAt,
                },
            });
        });
    });

    // 서버가 최신순으로 준다고 보고 그대로 씁니다. 클라이언트가 임의 정렬을 만들지 않습니다.
    return rows.sort((a, b) => b.item.processedAt.localeCompare(a.item.processedAt));
}

/**
 * 반납 ID 표시 코드.
 *
 * ERD `RETURN_ATTEMPT.return_attempt_id` 는 UUID 뿐이고 사람이 읽을 짧은 코드 컬럼이 없습니다.
 * 아래는 화면에서 읽히게 만든 **목업 표시 규칙**입니다.
 * TODO: 실연동 때 백엔드에 표시용 코드가 있는지 확인하세요.
 */
function returnAttemptIdOf(slot: Slot): string {
    return `RT-88${slot.slotId.slice(-3)}`;
}

/* ------------------------------------------------------------------ 목록 조회 */

export type AiResultFilter = 'ALL' | AiInspectionResult;
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

export interface InspectionPage {
    rows: InspectionRow[];
    /** 다음 쪽이 없으면 null. 총 건수·총 페이지 수는 응답에 없습니다. */
    nextCursor: string | null;
}

/**
 * `ADMIN-INSPECTION-001` 을 흉내 냅니다. query 는 계약에 있는 것만 받습니다:
 * `aiResult, reviewStatus, modelVersion, from, to, cursor, size`.
 *
 * 시안에 있던 `반납ID · 대여소 검색` 칸은 뺐습니다. 계약 query 에 키워드 검색이 없고,
 * "클라이언트가 승인되지 않은 필터를 만들지 않는다"가 목록 공통 규칙입니다.
 * 대신 계약에 있는 조회 기간(`from`)을 넣었습니다.
 */
export function listInspections(query: InspectionQuery): InspectionPage {
    const filtered = buildInspectionRows().filter(({ item }) => {
        if (query.aiResult !== 'ALL' && item.aiResult !== query.aiResult) return false;
        if (query.reviewStatus !== 'ALL' && item.reviewStatus !== query.reviewStatus) return false;
        if (query.from && item.processedAt.slice(0, 10) < query.from) return false;
        return true;
    });

    // cursor 는 서버만 해석합니다. 이 목업이 서버 역할이라 여기서만 풀어 씁니다.
    const offset = query.cursor ? Number(query.cursor.replace('c_', '')) : 0;
    const rows = filtered.slice(offset, offset + query.size);
    const next = offset + query.size;

    return { rows, nextCursor: next < filtered.length ? `c_${next}` : null };
}

/* ------------------------------------------------------------------ 상세 조회 */

/**
 * `ADMIN-INSPECTION-002` 를 흉내 냅니다.
 *
 * 판정 결과는 슬롯 목업 스토어(`slotOverrides`)에서 읽습니다. 관리자가 방금 저장한 판정이
 * 검수 상세·슬롯 상세·대여소 상세에서 같은 값으로 보여야 하기 때문입니다.
 */
export function findInspection(
    inspectionId: string | undefined,
): { detail: InspectionDetail; station: Station; slot: Slot } | undefined {
    const row = buildInspectionRows().find((entry) => entry.item.inspectionId === inspectionId);
    if (!row) return undefined;

    const outcome = outcomeOf(row.slot);
    const decided = row.item.reviewStatus === 'DECIDED';

    return {
        station: row.station,
        slot: row.slot,
        detail: {
            ...row.item,
            rentalId: row.item.returnAttemptId.replace('RT-', 'RN-'),
            decision: decided ? (outcome?.adminVerdict ?? null) : null,
            note: decided ? (outcome?.reason ?? null) : null,
            decidedAt: decided ? row.slot.updatedAt : null,
        },
    };
}
