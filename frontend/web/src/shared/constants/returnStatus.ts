import type { BadgeTone } from '@/shared/components/Badge';

/**
 * 반납 시도 상태 — `RETURN_ATTEMPT.status`.
 *
 * **실 응답을 표시하는 값입니다.** 슬롯 상세의 `latestReturnAttempt.status` 가 이 축이고
 * (`SlotDetailResponse` → `LatestReturnAttemptView`), 백엔드 `ReturnAttempt.Status` 열거형과
 * 같은 다섯 개입니다.
 *
 * ```
 * PROCESSING | PHYSICAL_DONE | COMPLETED | RECOVERY_REQUIRED | FAILED
 * ```
 *
 * **`REVIEW_PENDING`·`REVIEW_DONE` 은 없는 값이었습니다.** 그건 반납 상태가 아니라
 * **검수 처리 상태**(`ReviewStatus: PENDING | DECIDED`)인데 한 칸에 섞여 있었습니다.
 * `RECOVERY` 도 계약 값은 `RECOVERY_REQUIRED` 입니다.
 *
 * 화면흐름 §9.1 도 `status` · `InspectionResult` · `검수 처리 상태` 를 **세 개 따로**
 * 표시하라고 합니다. 섞으면 "반납은 끝났고 검수만 남았다"와 "반납 자체가 안 끝났다"를
 * 구분할 수 없습니다.
 *
 * ---
 *
 * **`features/history/types.ts` 에서 옮겨 왔습니다.** 이력 화면(대여·반납·정산)은 조회 API 가
 * 계약에 없어 목업만 돌려주다가 라우트째로 닫혔는데, 이 세 값만은 **실 응답을 그리는 데**
 * 쓰이고 있었습니다. 죽은 기능 폴더에 살아 있는 값이 섞여 있으면 지울 때마다 걸립니다.
 */
export type ReturnAttemptStatus =
    | 'PROCESSING'
    | 'PHYSICAL_DONE'
    | 'COMPLETED'
    | 'RECOVERY_REQUIRED'
    | 'FAILED';

export const RETURN_STATUS_LABEL: Record<ReturnAttemptStatus, string> = {
    PROCESSING: '처리 중',
    // 우산 삽입과 실제 잠금까지 끝난 물리 완료. 서버 반영은 아직입니다 (ERD §8.0).
    PHYSICAL_DONE: '물리 완료',
    COMPLETED: '반납완료',
    RECOVERY_REQUIRED: '복구 필요',
    FAILED: '실패',
};

export const RETURN_STATUS_TONE: Record<ReturnAttemptStatus, BadgeTone> = {
    PROCESSING: 'blue',
    PHYSICAL_DONE: 'blue',
    COMPLETED: 'green',
    RECOVERY_REQUIRED: 'red',
    FAILED: 'red',
};
