/**
 * 이력 목업이 요구하는 슬롯 상태 — **슬롯 목업과 이력 목업의 공통 출처**.
 *
 * 두 목업이 서로를 모르면 화면이 어긋납니다. 반납 이력에서 슬롯으로 넘어갔을 때 아무 문제
 * 없는 슬롯이 나오거나, 반납이 가리키는 검수가 존재하지 않는 식입니다. 실제로 둘 다
 * 있었습니다 — 반납의 `inspectionId` 8건이 전부 실재하지 않는 값이었고, 슬롯 없는 실패
 * 반납이 `/slots/null` 로 링크돼 있었습니다. 단위 테스트를 붙이고서야 드러났습니다.
 *
 * 그래서 슬롯 구성을 이력이 고정할 수 있게 열어 둡니다. 슬롯 목업은 평소 순환 패턴으로
 * 채우다가, 여기에 적힌 자리만 이 모양으로 바꿉니다.
 *
 * **이 파일이 import 를 갖지 않는 이유**: `slots.ts` 와 `history.ts` 가 둘 다 읽어야 하는데
 * `history.ts → refs.ts → slots.ts` 방향이 이미 있어서, 어느 한쪽에 두면 순환이 됩니다.
 * 값만 담은 이 모듈을 양쪽이 읽으면 출처가 하나로 유지됩니다.
 *
 * TODO: 실 API 연동 시 이 파일을 지우세요. 이런 상태는 서버가 만듭니다.
 */

/**
 * 고정할 슬롯 모양. `slots.ts` 의 `SlotPreset` 이름과 같은 값을 씁니다 — 여기서 그 타입을
 * import 하면 순환이 되므로 문자열로 두고, `slots.ts` 쪽에서 대조합니다.
 */
export type PinnedShape = 'RECOVERY' | 'ADMIN_REVIEW' | 'DAMAGED' | 'REVIEWED_NORMAL';

export interface PinnedSlot {
    stationName: string;
    slotNumber: number;
    shape: PinnedShape;
    /** 이력 쪽 어느 행이 이 자리를 요구하는지. 지울 때 무엇이 깨지는지 알 수 있게 적어 둡니다. */
    because: string;
}

/**
 * 이력이 자리까지 고정하는 슬롯.
 *
 * 검수가 걸린 반납들은 여기 적지 않습니다. `refs.ts` 가 **이미 그 상태인 슬롯을 골라**
 * 배정합니다 — 자리를 손으로 적어 두면 순환 패턴이 바뀔 때마다 같이 고쳐야 하는데,
 * 고르는 쪽은 저절로 따라옵니다. 순환 패턴으로는 절대 안 나오는 모양만 여기서 고정합니다.
 */
export const PINNED_SLOTS: readonly PinnedSlot[] = [
    {
        /*
         * 물리 반납은 끝났는데 서버 반영이 깨진 슬롯.
         *
         * 우산은 안에 들어가 잠겨 있고, DB 는 그 사실을 확정하지 못한 상태입니다.
         *   반납 시도 → `RECOVERY_REQUIRED`
         *   슬롯      → `OUT_OF_SERVICE` 로 격리, 점유·잠금은 `UNKNOWN`
         *
         * 근거가 둘입니다.
         *   ERD §9.2-7  "물리·DB 불일치는 `RECOVERY_REQUIRED` 와 `OUT_OF_SERVICE` 로
         *                수렴하고 성공 화면을 금지한다"
         *   ERD §8.1    "`RECOVERY_REQUIRED` 는 별도 복구 테이블이 아니라
         *                **반납·슬롯 상태**로 표현한다"
         *
         * 점유를 `UNKNOWN` 으로 두는 건 "확정할 수 없다" 를 그대로 담는 것입니다. 마지막
         * 센서값을 현재 실물 상태로 간주하지 않는다는 복구 규칙이 이걸 요구합니다.
         *
         * 이 모양은 순환 패턴에 없어서 고르는 방식으로는 나오지 않습니다. 그래서 고정합니다.
         */
        stationName: '정문 광장',
        slotNumber: 1,
        shape: 'RECOVERY',
        because: '반납 RT-88240 (RECOVERY_REQUIRED)',
    },
];

/** 이 자리에 고정된 모양. 없으면 순환 패턴을 그대로 씁니다. */
export function pinnedShapeOf(stationName: string, slotNumber: number): PinnedShape | null {
    return (
        PINNED_SLOTS.find((pin) => pin.stationName === stationName && pin.slotNumber === slotNumber)
            ?.shape ?? null
    );
}
