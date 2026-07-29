import { env } from '@/config/env';
import { http } from '@/lib/axios';
import {
    findInspection,
    listInspections,
    type AiResultFilter,
    type InspectionRow,
    type ReviewStatusFilter,
} from '@/features/inspections/mocks/inspections';
import type { InspectionDecisionInput, InspectionDetail } from '@/features/inspections/types';
import { applyInspectionDecision } from '@/features/stations/mocks/slotOverrides';
import type { Slot, Station } from '@/features/stations/types';

/**
 * 관리자 검수 — `ADMIN-INSPECTION-001/002/003` (API명세 B-4).
 *
 * **화면은 이 파일만 보고, 목업은 여기 뒤에 숨습니다.**
 * `env.useMockData` 를 내리면 실 API 로 갈아탑니다 — 페이지 코드는 그대로입니다.
 */

export interface InspectionListParams {
    /** 계약 query 그대로입니다: `aiResult,reviewStatus,modelVersion,from,to,cursor,size` */
    aiResult?: AiResultFilter;
    reviewStatus?: ReviewStatusFilter;
    modelVersion?: string;
    from?: string;
    to?: string;
    cursor?: string | null;
    size?: number;
}

/**
 * 목록 한 쪽.
 *
 * 목업은 대여소·슬롯을 같이 실어 줍니다 — 실 API 응답에는 `stationId`·`slotId` 만 오고
 * 대여소 이름도 슬롯 번호도 없어서, 화면이 그걸 어디선가 채워야 하기 때문입니다.
 * TODO: 백엔드에 `stationName`·`slotNumber` 추가를 요청하거나, 대여소 목록을 따로 조회해 붙이세요.
 */
export interface InspectionPageResult {
    rows: InspectionRow[];
    nextCursor: string | null;
}

/** 왕복이 있는 척해서 로딩 상태를 눈으로 확인할 수 있게 합니다. */
function delay<T>(value: T, ms = 180): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const inspectionsApi = {
    /** ADMIN-INSPECTION-001 — `GET /inspections` (전역 목록) */
    list: async (params: InspectionListParams = {}): Promise<InspectionPageResult> => {
        if (!env.useMockData) {
            const { data } = await http.get<InspectionPageResult>('/inspections', { params });
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
    detail: async (
        inspectionId: string,
    ): Promise<{ detail: InspectionDetail; station: Station; slot: Slot } | undefined> => {
        if (!env.useMockData) {
            const { data } = await http.get<InspectionDetail>(`/inspections/${inspectionId}`);
            // 실 응답에는 대여소·슬롯 객체가 없습니다. 화면이 필요로 하는 형태로 맞추려면
            // 여기서 슬롯 상세를 한 번 더 조회해 붙여야 합니다.
            // TODO: 연동 시 stationsApi.slotDetail 과 합치세요.
            throw new Error(`NOT_WIRED_YET: ${data.inspectionId}`);
        }

        return delay(findInspection(inspectionId));
    },

    /**
     * ADMIN-INSPECTION-003 — `PATCH /inspections/{inspectionId}/decision`
     *
     * 검수·슬롯·정산이 한 트랜잭션입니다. 409 `CONCURRENT_MODIFICATION` 이나
     * 409 `INSPECTION_ALREADY_DECIDED` 가 나면 **자동 재시도하지 않습니다** (전부 retryable=false).
     */
    decide: async (
        inspectionId: string,
        input: InspectionDecisionInput,
        slot: Slot,
    ): Promise<void> => {
        if (!env.useMockData) {
            await http.patch(`/inspections/${inspectionId}/decision`, {
                decision: input.decision,
                note: input.note,
                physicalStateConfirmed: input.physicalStateConfirmed,
                expectedUpdatedAt: input.expectedUpdatedAt,
                // TODO: reasonCode Enum 확정 시 추가. 지금은 `PHYSICAL_DAMAGE_CONFIRMED` 하나뿐입니다.
            });
            return;
        }

        applyInspectionDecision(slot, input);
        await delay(null, 120);
    },
};
