import { Link } from 'react-router-dom';

import { buttonVariants } from '@/components/ui/button';
import { PageTitle } from '@/shared/components/PageTitle';

export function NotFoundPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40">
            <PageTitle className="!text-6xl !text-primary" documentTitle="페이지를 찾을 수 없음">
                404
            </PageTitle>
            <p className="text-muted-foreground">페이지를 찾을 수 없습니다.</p>
            <Link to="/" className={buttonVariants({ variant: 'default' })}>
                대시보드로 돌아가기
            </Link>
        </div>
    );
}
