import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
// `vite` 가 아니라 `vitest/config` 에서 가져옵니다 — 아래 `test` 블록의 타입이 여기에만 있습니다.
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    /*
     * 테스트도 이 설정을 그대로 씁니다 — 별칭(`@`)·JSX 변환·TS 처리가 앱과 한 벌이라
     * 테스트에서만 어긋나는 일이 없습니다.
     *
     * `environment: 'jsdom'` 은 컴포넌트를 그리는 테스트에만 필요하지만, 순수 함수
     * 테스트에서도 비용이 크지 않아 파일마다 나누지 않고 하나로 둡니다.
     */
    test: {
        environment: 'jsdom',
        // 전역(`describe`·`it`)을 켜지 않고 파일마다 import 합니다. eslint 가
        // 선언 안 된 전역을 오류로 잡는 설정이라, 켜면 lint 예외를 따로 둬야 합니다.
        globals: false,
        setupFiles: ['./src/test/setup.ts'],
        // 소스와 테스트를 나란히 두는 대신 한곳에 모읍니다. 어떤 규칙이 걸려
        // 있는지 한눈에 보이고, 빌드 대상(`src/**` 중 `.test.` 제외)과도 안 섞입니다.
        include: ['src/**/*.test.{ts,tsx}'],
    },
    server: {
        port: 5173,
        // 백엔드 공통 응답 규격(/api)에 맞춘 개발용 프록시.
        // VITE_API_BASE_URL 을 절대 URL로 쓰면 이 프록시는 사용되지 않습니다.
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
        },
    },
});
