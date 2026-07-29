import type { LockStatus } from '@/features/stations/types';
import { cn } from '@/lib/utils';
import { LOCK_STATUS_LABEL } from '@/shared/constants/statusLabels';

/**
 * 슬롯 잠금 아이콘 — ERD `SLOT.lock_status`. 좌표는 시안 벡터 그대로입니다.
 *
 * **값이 넷입니다.** 예전에는 `locked: boolean` 하나만 받아서
 * `lockStatus === 'LOCKED'` 로 넘겼는데, 그러면 `UNKNOWN`(확인 불가)과 `ERROR`(잠금 오류)가
 * 둘 다 '열림'으로 그려집니다. ERD 가 `ERROR` 를 "잠금 상태를 확인하거나 제어할 수 없는
 * 상태"라고 정의했는데, 화면이 그걸 "문이 열려 있다"고 단정해 버리는 셈입니다.
 * 잠금장치 고장과 문 열림은 관리자가 할 일이 다릅니다.
 *
 * 그래서 모르는 상태를 '열림'으로 그리지 않습니다. `UNKNOWN`·`ERROR` 는 고리를 닫아 둔 채
 * 열쇠구멍 자리에 `?`·`!` 를 넣고 색으로 가릅니다. 확정된 `UNLOCKED` 만 고리를 엽니다.
 *
 * viewBox 는 그림보다 넉넉해야 합니다.
 * - 위: 고리 선(굵기 2.2)의 바깥쪽이 y=2.7 까지 올라감
 * - 오른쪽: 열림 상태의 고리가 몸통(x=19.4)보다 오른쪽 x=20.1 까지 나감
 * 좌표를 손보면 viewBox 도 같이 확인하세요. 안 그러면 아이콘이 잘립니다.
 */

/** 닫힌 고리 / 열린 고리 */
const SHACKLE_CLOSED = 'M8.5 10.4 V7.3 A3.5 3.5 0 0 1 15.5 7.3 V10.4';
const SHACKLE_OPEN = 'M12 10.4 V7.3 A3.5 3.5 0 0 1 19 7.3 V9.2';

interface Shape {
    /** 고리를 여는 건 '열려 있다'가 확정된 경우뿐입니다. */
    open: boolean;
    color: string;
    /** 열쇠구멍 자리에 넣을 글자. null 이면 기본 원. */
    mark: string | null;
}

const SHAPE: Record<LockStatus, Shape> = {
    LOCKED: { open: false, color: '#2196F3', mark: null },
    UNLOCKED: { open: true, color: '#A9B4BF', mark: null },
    // 확인 불가 — 회색이되 열렸다고 말하지 않습니다.
    UNKNOWN: { open: false, color: '#5D7285', mark: '?' },
    // 잠금장치 이상 — 눈에 띄어야 합니다.
    ERROR: { open: false, color: '#E0574A', mark: '!' },
};

export function SlotLockIcon({ status, className }: { status: LockStatus; className?: string }) {
    const shape = SHAPE[status];
    const label = LOCK_STATUS_LABEL[status];

    return (
        <svg
            viewBox="4.6 2.7 15.5 17.3"
            width="12.4"
            height="13.84"
            className={cn('shrink-0', className)}
            role="img"
            aria-label={label}
        >
            <title>{label}</title>
            <path
                d={shape.open ? SHACKLE_OPEN : SHACKLE_CLOSED}
                fill="none"
                stroke={shape.color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <rect x="4.6" y="10.4" width="14.8" height="9.6" rx="2.6" fill={shape.color} />
            {shape.mark ? (
                <text
                    x="12"
                    y="15.4"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="7.5"
                    fontWeight="700"
                    fill="#FFFFFF"
                >
                    {shape.mark}
                </text>
            ) : (
                <circle cx="12" cy="15.2" r="1.7" fill="#FFFFFF" />
            )}
        </svg>
    );
}
