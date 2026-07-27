import type { BadgeTone } from '@/shared/components/Badge';
import type { RowAccent } from '@/shared/components/DataTable';

/* ------------------------------------------------------------------ 대여소 */

export interface Station {
    /** 'ST-003' 형태의 대여소 ID */
    id: string;
    /** 대여소 표시명 (설치 건물/위치) */
    name: string;
    /** 대여 가능한 우산 수 */
    available: number;
    /** 슬롯 총 개수 */
    capacity: number;
    /** 파손으로 분류된 우산 수 */
    damaged: number;
    /** 관리자 검수 대기 우산 수 */
    adminReview: number;
    /** 기기 온라인 여부 */
    online: boolean;
    /** 분포도 위 좌표. 지도 영역 기준 백분율(0~100). */
    position: { x: number; y: number };
}

/** 대여소 재고 상태 */
export type StationStatus = 'SHORTAGE' | 'NORMAL' | 'SURPLUS' | 'OFFLINE';

/**
 * 재고 상태 임계값 (대여 가능 수량 기준).
 * TODO: 운영 정책 확정되면 대여소별 설정값으로 빼세요.
 */
export const STOCK_THRESHOLD = {
    /** 이 값 이상이면 과잉 */
    surplus: 40,
    /** 이 값 이상이면 적정, 미만이면 부족 */
    normal: 20,
} as const;

export function getStationStatus(station: Station): StationStatus {
    if (!station.online) return 'OFFLINE';
    if (station.available >= STOCK_THRESHOLD.surplus) return 'SURPLUS';
    if (station.available >= STOCK_THRESHOLD.normal) return 'NORMAL';
    return 'SHORTAGE';
}

/** 상태별 라벨 + Tailwind 클래스 (문자열 리터럴이어야 JIT 가 클래스를 뽑아냅니다) */
export const STATION_STATUS_META: Record<
    StationStatus,
    { label: string; bg: string; text: string }
> = {
    SHORTAGE: { label: '부족', bg: 'bg-status-shortage', text: 'text-status-shortage' },
    NORMAL: { label: '적정', bg: 'bg-status-normal', text: 'text-status-normal' },
    SURPLUS: { label: '과잉', bg: 'bg-status-surplus', text: 'text-status-surplus' },
    OFFLINE: {
        label: '오프라인',
        bg: 'bg-status-offline',
        text: 'text-status-offline-text',
    },
};

/** 지도 범례에 노출할 상태 (오프라인은 범례에서 제외) */
export const LEGEND_STATUSES: StationStatus[] = ['SHORTAGE', 'NORMAL', 'SURPLUS'];

/** 재고 순위 정렬: 운영 중인 대여소를 잔량 많은 순으로, 오프라인은 맨 뒤로 */
export function sortByStock(stations: Station[]): Station[] {
    return [...stations].sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return b.available - a.available;
    });
}

/* -------------------------------------------------------------------- 슬롯 */

export type SlotStatus = 'AVAILABLE' | 'RENTED' | 'EMPTY' | 'DAMAGED' | 'ADMIN_REVIEW';

export interface Slot {
    /** 'SL-03-01' 형태의 슬롯 ID */
    id: string;
    status: SlotStatus;
    /** 잠금 상태 */
    locked: boolean;
    online: boolean;
    /** 'MM-DD HH:mm' 형태의 최근 갱신 시각 */
    updatedAt: string;
}

/** 슬롯 상태 → 배지 톤 / 행 강조 바 */
export const SLOT_STATUS_META: Record<SlotStatus, { tone: BadgeTone; accent?: RowAccent }> = {
    AVAILABLE: { tone: 'green' },
    RENTED: { tone: 'blue' },
    EMPTY: { tone: 'slate' },
    DAMAGED: { tone: 'red', accent: 'red' },
    ADMIN_REVIEW: { tone: 'amber', accent: 'amber' },
};

/**
 * 슬롯에 우산이 없으면(대여 중 / 빈 슬롯) 잠금이 풀려 있습니다.
 * TODO: 실제 기기 상태 API 가 붙으면 응답값을 그대로 쓰고 이 함수는 지우세요.
 */
export function isSlotLocked(status: SlotStatus): boolean {
    return status !== 'RENTED' && status !== 'EMPTY';
}

/** 검수 화면으로 넘겨야 하는 상태인지 */
export function needsInspection(status: SlotStatus): boolean {
    return status === 'ADMIN_REVIEW';
}
