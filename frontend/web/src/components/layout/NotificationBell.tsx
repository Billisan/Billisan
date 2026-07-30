import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useSettlements } from '@/features/history/hooks/useHistory';
import { useInspectionList } from '@/features/inspections/hooks/useInspections';
import { cn } from '@/lib/utils';

/**
 * 헤더 알림.
 *
 * **알림 API 는 없습니다.** 관리자 계약 10개(`ADMIN-AUTH-001~003`, `ADMIN-INVENTORY-001`,
 * `ADMIN-SLOT-001`·`ADMIN-SLOT-DETAIL-001`·`ADMIN-SLOT-STATUS-001`,
 * `ADMIN-INSPECTION-001~003`)에 알림이 없고, 12-R PART D 의 후보 목록에도 없습니다.
 * 그래서 알림 목록을 지어내지 않습니다 — 근거 없는 데이터를 화면에 올리면 관리자가
 * 그걸 믿고 판단합니다.
 *
 * 대신 **이미 계약에 있는 값**으로 채웁니다. 관리자가 지금 손대야 하는 건 둘입니다.
 *   파손 검수 미처리 — `ADMIN-INSPECTION-001` 의 `reviewStatus=PENDING`
 *   미정산          — 정산 이력의 `status=PENDING`
 * 대시보드의 처리 대기 카드와 **같은 조회**를 씁니다. 두 곳 숫자가 어긋나지 않습니다.
 *
 * 빨간 점은 실제로 처리할 게 있을 때만 찍습니다. 예전에는 늘 찍혀 있고 눌러도 아무 일이
 * 없었습니다 — 늘 켜진 알림은 정보가 아니라 소음입니다.
 */

interface Item {
    label: string;
    /** 조회 전에는 null. 0 을 먼저 보여 주면 '없다' 로 읽힙니다. */
    count: number | null;
    to: string;
    hint: string;
}

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    // 대시보드 처리 대기 카드와 같은 조건입니다.
    const inspections = useInspectionList({ reviewStatus: 'PENDING', size: 100 });
    const settlements = useSettlements();

    const items: Item[] = [
        {
            label: '파손 검수 미처리',
            count: inspections.data ? inspections.data.items.length : null,
            to: '/inspections?review=PENDING',
            hint: '관리자 판정이 필요합니다',
        },
        {
            label: '미정산',
            count: settlements.data
                ? settlements.data.filter((item) => item.status === 'PENDING').length
                : null,
            to: '/history/settlements?status=PENDING',
            hint: '납부가 끝나지 않은 정산입니다',
        },
    ];

    const actionable = items.filter((item) => (item.count ?? 0) > 0);
    const loading = items.some((item) => item.count === null);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent) => {
            if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        window.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div ref={wrapRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="relative flex size-9 items-center justify-center rounded-lg text-brand-navy-label transition-colors hover:bg-brand-navy-hover"
            >
                <span className="sr-only">
                    {actionable.length ? '알림 · 확인이 필요한 항목 있음' : '알림'}
                </span>
                <Bell className="size-[19px]" aria-hidden />
                {/* 시안의 점은 흰 테두리가 아니라 헤더 배경색으로 파낸 형태입니다. */}
                {actionable.length > 0 && (
                    <span
                        className="absolute right-[7px] top-[6px] size-[9px] rounded-full border-2 border-brand-navy bg-status-shortage"
                        aria-hidden
                    />
                )}
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+10px)] w-[268px] overflow-hidden rounded-[10px] bg-white py-[6px] shadow-[0_8px_24px_rgba(11,18,32,0.18)]"
                >
                    <p className="px-[14px] pb-[8px] pt-[6px] text-[11.5px] font-bold text-brand-muted">
                        확인이 필요한 항목
                    </p>
                    <span className="block h-px bg-brand-line-soft" aria-hidden />

                    {loading && (
                        <p className="px-[14px] py-[14px] text-[12px] font-medium text-brand-muted">
                            불러오는 중입니다…
                        </p>
                    )}

                    {!loading && actionable.length === 0 && (
                        <p className="px-[14px] py-[14px] text-[12px] font-medium text-brand-muted">
                            지금 처리할 항목이 없습니다.
                        </p>
                    )}

                    {actionable.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="flex items-center justify-between gap-3 px-[14px] py-[10px] transition-colors hover:bg-brand-surface"
                        >
                            <span className="min-w-0">
                                <span className="block truncate text-[12.5px] font-bold text-brand-ink">
                                    {item.label}
                                </span>
                                <span className="mt-[2px] block truncate text-[11.5px] font-medium text-brand-muted">
                                    {item.hint}
                                </span>
                            </span>
                            <span
                                className={cn(
                                    'shrink-0 rounded-full bg-status-shortage/10 px-[8px] py-[2px]',
                                    'text-[11.5px] font-extrabold tabular-nums text-status-shortage',
                                )}
                            >
                                {item.count}건
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
