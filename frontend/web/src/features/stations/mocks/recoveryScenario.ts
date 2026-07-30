/**
 * 복구가 필요한 반납 시나리오 — **슬롯 목업과 반납 목업의 공통 출처**.
 *
 * 명세가 이 둘을 묶어 놨습니다.
 *   ERD §9.2-7  "물리·DB 불일치는 `RECOVERY_REQUIRED` 와 `OUT_OF_SERVICE` 로 수렴하고
 *                성공 화면을 금지한다"
 *   ERD §8.1    "`RECOVERY_REQUIRED` 는 별도 복구 테이블이 아니라 **반납·슬롯 상태**로 표현한다"
 *   부팅 복구    "불일치하거나 확정할 수 없는 슬롯은 `RECOVERY_REQUIRED` 로 격리한다"
 *
 * 그래서 반납만 `복구 필요` 인데 슬롯은 멀쩡하면 안 됩니다. 관리자가 반납 이력에서 그 건을
 * 찾아 슬롯으로 넘어갔을 때 아무 문제 없는 슬롯이 나오면 동선이 거기서 끊깁니다.
 *
 * **이 파일이 import 를 갖지 않는 이유**: `slots.ts` 와 `history.ts` 가 둘 다 읽어야 하는데
 * `history.ts → refs.ts → slots.ts` 방향이 이미 있어서, 어느 한쪽에 두면 순환이 됩니다.
 * 값만 담은 이 모듈을 양쪽이 읽으면 출처가 하나로 유지됩니다.
 *
 * TODO: 실 API 연동 시 이 파일을 지우세요. 이런 상태는 서버가 만듭니다.
 */

/** 대여소 이름 + 슬롯 번호. 목업이 대여소를 이름으로 찾으므로 같은 기준을 씁니다. */
export interface SlotRef {
    stationName: string;
    slotNumber: number;
}

/**
 * 물리 반납은 끝났는데 서버 반영이 깨진 슬롯.
 *
 * 우산은 안에 들어가 잠겨 있고, DB 는 그 사실을 확정하지 못한 상태입니다. 그래서
 *   - 반납 시도 → `RECOVERY_REQUIRED`
 *   - 슬롯      → `OUT_OF_SERVICE` 로 격리, 점유·잠금은 `UNKNOWN`
 *
 * 점유를 `UNKNOWN` 으로 두는 건 "확정할 수 없다" 를 그대로 담는 것입니다. 마지막 센서값을
 * 현재 실물 상태로 간주하지 않는다는 복구 규칙(8번)이 이걸 요구합니다.
 */
export const RECOVERY_SLOTS: readonly SlotRef[] = [{ stationName: '정문 광장', slotNumber: 1 }];

/** 같은 슬롯인지 (대여소 이름 + 번호로 비교) */
export function isRecoverySlot(stationName: string, slotNumber: number): boolean {
    return RECOVERY_SLOTS.some(
        (item) => item.stationName === stationName && item.slotNumber === slotNumber,
    );
}
