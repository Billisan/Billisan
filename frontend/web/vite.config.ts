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
         * **기본값은 프록시 없음입니다.** `npm run dev` 는 목업 전용이고, 5173 에서
         * 나가는 API 요청 경로가 아예 존재하지 않습니다. `/api` 로 뭘 보내든 dev 서버가
         * 자기 자신에서 404 로 끝내고, 이 컴퓨터 밖으로 한 바이트도 나가지 않습니다.
         *
         * 설정(`VITE_USE_MOCK_DATA`)에만 기대지 않으려고 이렇게 둡니다. 플래그는 누구든
         * 실수로 내릴 수 있지만, 없는 프록시는 실수로 켜지지 않습니다. 실제로 팀 서버
         * 로그가 우리 개발 요청으로 더럽혀진 적이 있어서 파이프 자체를 끊어 둡니다.
         *
         * 백엔드에 붙여야 할 때만 **주소를 명시해서** 켭니다:
         *
         *   $env:DEV_API_PROXY_TARGET="http://localhost:8080"; npm run dev
         *
         * 접두사가 `VITE_` 가 아닙니다. 그래야 이 주소가 클라이언트 번들에 안 들어갑니다.
         *
         * **절대 URL 로 우회하지 마세요.** `VITE_API_BASE_URL` 에 `http://…` 를 넣으면
         * 프록시를 건너뛰고 브라우저가 서버로 직접 나가는데, 그 주소가 번들에 구워져
         * **dev 서버를 꺼도 열려 있는 탭이 계속 그 서버로 요청합니다.** 실제로 겪은 일입니다.
         * 프록시로 두면 브라우저가 아는 주소는 `localhost:5173` 뿐이라, dev 서버가 죽는
         * 순간 연결 거부로 끝나고 팀 서버까지 닿지 못합니다.
         */
        proxy: process.env.DEV_API_PROXY_TARGET
            ? {
                  '/api': {
                      target: process.env.DEV_API_PROXY_TARGET,
                      changeOrigin: true,
                  },
              }
            : undefined,
    },
});
