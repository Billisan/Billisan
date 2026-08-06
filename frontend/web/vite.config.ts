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
        /*
         * 백엔드 공통 응답 규격(/api)에 맞춘 개발용 프록시.
         *
         * **실 API 검증도 이 프록시로 하세요.** `VITE_API_BASE_URL` 에 절대 URL 을 넣으면
         * 프록시를 건너뛰고 브라우저가 서버로 직접 나갑니다. 그러면 주소가 번들에 구워져
         * **dev 서버를 꺼도 열려 있는 탭이 계속 그 서버로 요청합니다.** 실제로 그 일이
         * 있었습니다 — 서버를 껐는데도 팀 서버 로그에 우리 요청이 계속 찍혔습니다.
         *
         * 프록시로 두면 브라우저가 아는 주소는 `localhost:5173` 뿐입니다. dev 서버가
         * 죽는 순간 요청은 연결 거부로 끝나고 **팀 서버까지 닿지 못합니다.** CORS 도
         * 아예 발생하지 않습니다 — 브라우저 입장에선 같은 오리진입니다.
         *
         * 접두사가 `VITE_` 가 아닙니다. 그래야 이 주소가 클라이언트 번들에 안 들어갑니다.
         *
         *   DEV_API_PROXY_TARGET=http://<host>:8080 npm run dev
         */
        proxy: {
            '/api': {
                target: process.env.DEV_API_PROXY_TARGET ?? 'http://localhost:8080',
                changeOrigin: true,
            },
        },
    },
});
