import { Construction } from 'lucide-react';

import { PageTitle } from '@/shared/components/PageTitle';

/**
 * 아직 화면이 없는 메뉴용 임시 페이지.
 * 사이드바 메뉴를 눌렀을 때 404 로 빠지지 않게 하려는 용도이며,
 * 해당 도메인 화면이 만들어지면 라우터에서 이 항목을 지우면 됩니다.
 */
export function PlaceholderPage({ title }: { title: string }) {
    return (
        <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg bg-white">
            <Construction className="size-7 text-brand-placeholder" aria-hidden />
            <PageTitle className="!text-[14.5px]">{title}</PageTitle>
            <p className="text-xs font-medium text-brand-muted">아직 준비 중인 화면입니다.</p>
        </div>
    );
}
