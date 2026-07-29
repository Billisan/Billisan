import { RouterProvider } from 'react-router-dom';

import { AppProviders } from '@/app/AppProviders';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { router } from '@/app/router';
import { Toaster } from '@/shared/components/toast/Toaster';

function App() {
    return (
        // 오류 경계가 가장 바깥입니다. 라우터·Query 프로바이더에서 나는 예외까지 잡습니다.
        <ErrorBoundary>
            <AppProviders>
                <RouterProvider router={router} />
                {/* 라우트 밖에 둡니다. 로그인 화면에서도 알림이 떠야 합니다. */}
                <Toaster />
            </AppProviders>
        </ErrorBoundary>
    );
}

export default App;
