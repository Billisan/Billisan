import { cn } from '@/lib/utils';

/**
 * 슬롯 잠금 아이콘. 좌표는 시안 벡터 그대로입니다.
 *
 * viewBox 는 그림보다 넉넉해야 합니다.
 * - 위: 고리 선(굵기 2.2)의 바깥쪽이 y=2.7 까지 올라감
 * - 오른쪽: 열림 상태의 고리가 몸통(x=19.4)보다 오른쪽 x=20.1 까지 나감
 * 좌표를 손보면 viewBox 도 같이 확인하세요. 안 그러면 아이콘이 잘립니다.
 */
export function SlotLockIcon({ locked, className }: { locked: boolean; className?: string }) {
    const color = locked ? '#2196F3' : '#A9B4BF';

    return (
        <svg
            viewBox="4.6 2.7 15.5 17.3"
            width="12.4"
            height="13.84"
            className={cn('shrink-0', className)}
            role="img"
            aria-label={locked ? '잠김' : '열림'}
        >
            <path
                d={
                    locked
                        ? 'M8.5 10.4 V7.3 A3.5 3.5 0 0 1 15.5 7.3 V10.4'
                        : 'M12 10.4 V7.3 A3.5 3.5 0 0 1 19 7.3 V9.2'
                }
                fill="none"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <rect x="4.6" y="10.4" width="14.8" height="9.6" rx="2.6" fill={color} />
            <circle cx="12" cy="15.2" r="1.7" fill="#FFFFFF" />
        </svg>
    );
}
