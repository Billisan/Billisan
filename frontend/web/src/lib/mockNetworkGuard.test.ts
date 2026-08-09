import { describe, expect, it, vi } from 'vitest';

/**
 * 목업 모드 네트워크 차단 검사.
 *
 * 「목업으로 개발 중」과 「팀 서버로 요청이 나감」이 동시에 성립하면 안 됩니다.
 * 백엔드 팀이 EC2 에서 작업하는 동안 우리 개발 요청이 그쪽 로그에 섞이면, 그쪽은
 * 원인을 우리 쪽에서 찾을 방법이 없습니다.
 *
 * **설정만으로는 부족합니다.** 목업 분기는 api 모듈마다 흩어져 있어서 한 곳만
 * 빠뜨려도 조용히 샙니다 — 지금은 지운 `historyApi` 가 정확히 그랬습니다
 * (`env.useMockData` 분기가 아예 없었습니다). 그래서 axios 인터셉터에 마지막
 * 관문을 두고, 그 관문이 실제로 닫히는지를 여기서 확인합니다.
 *
 * 차단은 **개발 모드 + 두 플래그가 모두 켜졌을 때만** 걸립니다. 배포 번들은
 * `import.meta.env.DEV` 가 false 라 이 코드가 통째로 사라집니다.
 */

/** `@/config/env` 를 원하는 조합으로 갈아 끼우고 http 를 새로 읽습니다. */
async function loadHttp(useMockData: boolean, mockAuth: boolean) {
    vi.resetModules();
    vi.doMock('@/config/env', () => ({
        env: {
            apiBaseUrl: '/api/v1/admin',
            useMockData,
            mockAuth,
            authBypass: false,
            appName: 'test',
            demoAdminId: 'a',
            demoAdminPassword: 'b',
        },
    }));
    const { http } = await import('@/lib/axios');
    return http;
}

describe('목업 모드 네트워크 차단', () => {
    it('전목업(둘 다 true)이면 요청이 나가지 않는다', async () => {
        const http = await loadHttp(true, true);

        /*
         * 어댑터를 감시해서 **정말로 안 나갔는지**를 봅니다. 거절만 확인하면
         * "요청은 보내 놓고 응답을 버렸다" 와 구분되지 않습니다.
         */
        const adapter = vi.fn();
        await expect(http.get('/stations/x/slots', { adapter })).rejects.toThrow(
            /목업 모드에서 네트워크 요청이 발생했습니다/,
        );
        expect(adapter, '어댑터가 불렸다면 요청이 실제로 나간 것입니다').not.toHaveBeenCalled();
    });

    it('오류 문구가 어느 요청인지 알려 준다', async () => {
        const http = await loadHttp(true, true);
        // 「어딘가에서 샜다」로 끝나면 범인을 못 찾습니다. 메서드와 경로가 필요합니다.
        await expect(http.post('/inspections/abc/decision', {})).rejects.toThrow(
            /POST \/inspections\/abc\/decision/,
        );
    });

    it('실 API 모드(둘 다 false)는 막지 않는다', async () => {
        const http = await loadHttp(false, false);

        const adapter = vi.fn().mockResolvedValue({
            data: { slots: [] },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });

        await expect(http.get('/stations/x/slots', { adapter })).resolves.toBeDefined();
        expect(adapter).toHaveBeenCalled();
    });

    it('한쪽만 목업이면 막지 않는다 — 그 부분만 실 API 로 보겠다는 뜻입니다', async () => {
        const http = await loadHttp(true, false);

        const adapter = vi.fn().mockResolvedValue({
            data: {},
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });

        await expect(http.post('/auth/login', {}, { adapter })).resolves.toBeDefined();
        expect(adapter).toHaveBeenCalled();
    });
});
