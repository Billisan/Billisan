import { env } from '@/config/env';
import { http } from '@/lib/axios';
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
} from '@/features/inspections/types';
import { applyInspectionDecision } from '@/features/stations/mocks/slotOverrides';

/**
 * 관리자 검수 — `ADMIN-INSPECTION-001/002/003` (12-R PART B-5).
 *
 * **화면은 이 파일만 보고, 목업은 여기 뒤에 숨습니다.**
 * `env.useMockData` 를 내리면 실 API 로 갈아탑니다 — 페이지 코드는 그대로입니다.
 *
 * 세 응답 모두 `stationName`·`slotNumber` 를 포함한다고 보고 만들었습니다. 원본 12-R 에는
 * 없는 필드이고 백엔드에 추가를 요청한 상태입니다 (`features/inspections/types` 주석 참고).
 */

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
            const { data } = await http.get<InspectionPage>('/inspections', { params });
            return data;
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
    detail: async (inspectionId: string): Promise<InspectionDetail | undefined> => {
        if (!env.useMockData) {
            const { data } = await http.get<InspectionDetail>(`/inspections/${inspectionId}`);
            return data;
        }

        return delay(findInspection(inspectionId));
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
