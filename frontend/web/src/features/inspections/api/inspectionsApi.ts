import { env } from '@/config/env';
import { http } from '@/lib/axios';
import { errorStatusOf } from '@/lib/api-error';
import {
    findInspection,
    listInspections,
    slotOfInspection,
    type AiResultFilter,
    type InspectionPage,
    type ReviewStatusFilter,
} from '@/features/inspections/mocks/inspections';
import type {
    InspectionDecisionInput,
    InspectionDecisionResult,
    InspectionDetail,
    InspectionListItem,
} from '@/features/inspections/types';
import { stationsApi } from '@/features/stations/api/stationsApi';
import { applyInspectionDecision } from '@/features/stations/mocks/slotOverrides';

/**
 * 관리자 검수 — `ADMIN-INSPECTION-001/002/003` (12-R PART B-5).
 *
 * **화면은 이 파일만 보고, 목업은 여기 뒤에 숨습니다.**
 * `env.useMockData` 를 내리면 실 API 로 갈아탑니다 — 페이지 코드는 그대로입니다.
 *
 * `stationName`·`slotNumber` 는 실제 응답에 **없습니다** (EC2 실측 2026-08-01).
 * 백엔드 추가 요청은 미반영이라, 실 모드에서는 아래 표시 명부로 짜 맞춰 채웁니다.
 */

/* ------------------------------------------------- 실모드 표시 보강 (이름 명부) */

interface DisplayDirectory {
    stationNameById: Map<string, string>;
    slotNumberById: Map<string, number>;
}

/**
 * `stationId`→이름, `slotId`→슬롯 번호 명부.
 *
 * 응답을 늘려 달라고 조르는 대신 **있는 계약 API 로 풉니다** — 대여소 목록(시드+재고)과
 * `ADMIN-SLOT-001` 이 두 값을 이미 줍니다. 이름·번호는 시연 중 바뀌지 않는 값이라
 * 모듈 수명 동안 한 번만 받습니다. 실패하면 캐시를 비워 다음 조회 때 다시 시도하고,
 * 목록 자체는 명부 없이도 나갑니다 — 화면이 축약 ID 로 버팁니다 (types 주석 참고).
 */
let directoryPromise: Promise<DisplayDirectory> | null = null;

function loadDirectory(): Promise<DisplayDirectory> {
    directoryPromise ??= (async () => {
        const stations = await stationsApi.list();
        const slotLists = await Promise.all(
            stations.map((station) => stationsApi.slots(station.stationId)),
        );
        return {
            stationNameById: new Map(stations.map((s) => [s.stationId, s.name])),
            slotNumberById: new Map(
                slotLists.flatMap((list) =>
                    list.items.map((s): [string, number] => [s.slotId, s.slotNumber]),
                ),
            ),
        };
    })().catch((error) => {
        directoryPromise = null;
        throw error;
    });
    return directoryPromise;
}

/** 명부가 없어도 목록은 살립니다 — 이름 없는 행이 오류 화면보다 낫습니다. */
async function displayFieldsOf(
    item: Pick<InspectionListItem, 'stationId' | 'slotId'>,
): Promise<Pick<InspectionListItem, 'stationName' | 'slotNumber'>> {
    try {
        const directory = await loadDirectory();
        return {
            stationName: directory.stationNameById.get(item.stationId),
            slotNumber: directory.slotNumberById.get(item.slotId),
        };
    } catch {
        return {};
    }
}

export interface InspectionListParams {
    /** 계약 query 그대로입니다: `aiResult,reviewStatus,modelVersion,from,to,cursor,size` */
    aiResult?: AiResultFilter;
    reviewStatus?: ReviewStatusFilter;
    modelVersion?: string;
    from?: string;
    to?: string;
    cursor?: string | null;
    /** 기본 20, 최소 1, 최대 100 */
    size?: number;
}

/** 왕복이 있는 척해서 로딩 상태를 눈으로 확인할 수 있게 합니다. */
function delay<T>(value: T, ms = 180): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const inspectionsApi = {
    /**
     * ADMIN-INSPECTION-001 — `GET /inspections` (전역 목록)
     *
     * 서버 정렬은 미처리(`PENDING`) 우선, 같은 상태에서는 `processedAt` 내림차순입니다.
     * 클라이언트가 다시 정렬하지 않습니다.
     */
    list: async (params: InspectionListParams = {}): Promise<InspectionPage> => {
        if (!env.useMockData) {
            /*
             * 화면 필터값을 계약 query 로 번역합니다 (백엔드 실측 근거).
             *  - `'ALL'` 은 목업 필터의 "전체" 센티널입니다. 서버 enum 에 없는 값이라
             *    그대로 보내면 변환 실패(400)입니다 — "파라미터를 안 보냄"이 계약의 전체입니다.
             *  - 빈 값도 보내지 않습니다.
             *  - 날짜만 있는 `from`/`to` 에는 자정을 붙입니다 — 서버가
             *    `@DateTimeFormat(ISO.DATE_TIME)` LocalDateTime 이라 `2026-08-01` 은
             *    파싱 실패(400)이고 `2026-08-01T00:00:00` 이어야 합니다.
             */
            const query: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(params)) {
                if (value === undefined || value === null || value === '' || value === 'ALL')
                    continue;
                query[key] =
                    (key === 'from' || key === 'to') && /^\d{4}-\d{2}-\d{2}$/.test(String(value))
                        ? `${value}T00:00:00`
                        : value;
            }
            const { data } = await http.get<InspectionPage>('/inspections', { params: query });
            const display = await Promise.all(data.items.map(displayFieldsOf));
            return {
                ...data,
                items: data.items.map((item, i) => ({ ...item, ...display[i] })),
            };
        }

        return delay(
            listInspections({
                aiResult: params.aiResult ?? 'ALL',
                reviewStatus: params.reviewStatus ?? 'ALL',
                from: params.from ?? '',
                cursor: params.cursor ?? null,
                size: params.size ?? 8,
            }),
        );
    },

    /** ADMIN-INSPECTION-002 — `GET /inspections/{inspectionId}` */
    detail: async (inspectionId: string): Promise<InspectionDetail | null> => {
        if (!env.useMockData) {
            try {
                const { data } = await http.get<InspectionDetail>(`/inspections/${inspectionId}`);
                return { ...data, ...(await displayFieldsOf(data)) };
            } catch (error) {
                // 404 는 "정말 없음"입니다. 오류 화면(다시 시도)이 아니라 NotFound 로 가릅니다.
                if (errorStatusOf(error) === 404) return null;
                throw error;
            }
        }

        return delay(findInspection(inspectionId) ?? null);
    },

    /**
     * ADMIN-INSPECTION-003 — `PATCH /inspections/{inspectionId}/decision`
     *
     * 검수·슬롯·정산이 한 트랜잭션입니다. `reasonCode` 는 필수이고, 409
     * (`CONCURRENT_MODIFICATION` · `INSPECTION_ALREADY_DECIDED`) 는 **자동 재시도하지 않습니다**.
     *
     * 응답이 판정 후 슬롯·정산 권위 상태를 통째로 줍니다. 다만 계약이 "성공 후 관련 목록
     * 캐시를 무효화하고 서버 최종 상태를 다시 조회"라고 해서 훅에서는 무효화 쪽을 씁니다.
     */
    decide: async (
        inspectionId: string,
        input: InspectionDecisionInput,
    ): Promise<InspectionDecisionResult | null> => {
        if (!env.useMockData) {
            const { data } = await http.patch<InspectionDecisionResult>(
                `/inspections/${inspectionId}/decision`,
                {
                    decision: input.decision,
                    // 필수입니다. 빠지면 422 ADMIN_REASON_REQUIRED 입니다.
                    reasonCode: input.reasonCode,
                    note: input.note || null,
                    physicalStateConfirmed: input.physicalStateConfirmed,
                    expectedUpdatedAt: input.expectedUpdatedAt,
                },
            );
            return data;
        }

        // 목업은 슬롯을 직접 찾아 4축을 바꿉니다. 실 API 에는 이런 조회가 없습니다.
        const slot = slotOfInspection(inspectionId);
        if (slot) applyInspectionDecision(slot, input);
        return delay(null, 120);
    },
};
