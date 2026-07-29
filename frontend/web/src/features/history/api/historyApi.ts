import {
    findRental,
    findReturn,
    findSettlement,
    MOCK_RENTALS,
    MOCK_RETURNS,
    MOCK_SETTLEMENTS,
    MOCK_USER,
    type UserSummary,
} from '@/features/history/mocks/history';
import type { Rental, ReturnAttempt, Settlement } from '@/features/history/types';

/**
 * 대여·반납·정산·사용자 이력 조회.
 *
 * **확정 API 가 없습니다.** 화면 카탈로그(11번 §5)에서 이 6장 + 사용자 이력이 전부 P1 이고,
 * 12-R PART B 의 관리자 P0 10개에도 들어 있지 않습니다. 그래서 여기는 아직 목업만 돌려줍니다.
 *
 * 그래도 api 모듈을 두는 이유는 두 가지입니다.
 * 1. 화면이 목업을 직접 import 하면 나중에 연동할 때 페이지를 전부 다시 건드려야 합니다.
 * 2. 동기로 읽으면 로딩·오류 상태를 만들 자리가 없어서, 실 API 를 붙이는 순간
 *    빈 화면이 번쩍이거나 실패가 조용히 빈 표로 나타납니다.
 *
 * TODO: 이력 API 가 계약에 들어오면 각 함수 본문만 http 호출로 바꾸세요.
 */

/** 왕복이 있는 척해서 로딩 상태를 눈으로 확인할 수 있게 합니다. */
function delay<T>(value: T, ms = 180): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const historyApi = {
    rentals: async (): Promise<Rental[]> => delay(MOCK_RENTALS),
    rental: async (id: string): Promise<Rental | null> => delay(findRental(id) ?? null),

    returns: async (): Promise<ReturnAttempt[]> => delay(MOCK_RETURNS),
    returnAttempt: async (id: string): Promise<ReturnAttempt | null> =>
        delay(findReturn(id) ?? null),

    settlements: async (): Promise<Settlement[]> => delay(MOCK_SETTLEMENTS),
    settlement: async (id: string): Promise<Settlement | null> => delay(findSettlement(id) ?? null),

    /** 사용자 통합 이력 — `SCR-WEB-USER-HISTORY-001`. 최소 식별 정보만 다룹니다 (§6.3). */
    user: async (_userId: string): Promise<UserSummary> => delay(MOCK_USER),
};
