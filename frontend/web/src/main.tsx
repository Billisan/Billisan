import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Pretendard 가변 폰트(동적 서브셋). 유니코드 범위별로 쪼개져 있어서
// 실제 화면에 쓰인 글자 범위만 내려받습니다. 폰트 스택은 tailwind.config.js 참고.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';

import App from '@/App';
import '@/styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('#root 엘리먼트를 찾을 수 없습니다.');
}

createRoot(rootElement).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
