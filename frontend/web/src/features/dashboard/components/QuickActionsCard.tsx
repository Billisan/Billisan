import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Panel } from '@/features/dashboard/components/Panel';
import { cn } from '@/lib/utils';
import { OPERATION_SUMMARY } from '@/shared/constants/operationSummary';

interface QuickAction {
    label: string;
    count: number;
    to: string;
}

const QUICK_ACTIONS: QuickAction[] = [
    {
        label: '파손 검수 대기',
        count: OPERATION_SUMMARY.pendingInspections,
        to: '/inspections',
    },
    {
        label: '미정산 처리',
        count: OPERATION_SUMMARY.pendingSettlements,
        to: '/settlements',
    },
];

export function QuickActionsCard({ className }: { className?: string }) {
    return (
        <Panel className={cn('gap-3 p-[18px]', className)}>
            {QUICK_ACTIONS.map((action) => (
                <Link
                    key={action.to}
                    to={action.to}
                    className="flex h-11 items-center justify-between rounded-lg bg-brand-surface px-[14px] transition-colors hover:bg-brand-track"
                >
                    <span className="text-[12.5px] font-semibold text-brand-body">
                        {action.label}
                    </span>
                    <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-brand-blue-ink">
                        {action.count}건
                        <ArrowRight className="size-[13px]" aria-hidden />
                    </span>
                </Link>
            ))}
        </Panel>
    );
}
