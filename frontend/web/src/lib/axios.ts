import axios, { AxiosError, type AxiosInstance } from 'axios';

import { env } from '@/config/env';
import { ApiRequestError } from '@/lib/api-error';
import { newRequestId } from '@/lib/requestId';
import { getAccessToken, useAuthStore } from '@/features/auth/stores/authStore';
import { readApiError, unwrapEnvelope } from '@/shared/types/api';

/**
 * 공용 Axios 인스턴스.
 *  - 요청: `Authorization: Bearer`, `X-Request-Id: <UUID>` 자동 첨부
 *  - 응답: 공통 봉투를 벗겨 data 만 반환 (두 가지 봉투 모두 지원)
 *  - 실패: ApiRequestError 로 변환해 throw
 *
 * `baseURL` 은 `/api/v1/admin` 입니다. 관리자 Web 이 부를 수 있는 건 그 아래 10개뿐이고,
 * Pi·Orin·pgvector 로 직접 나가는 경로는 없습니다 (API명세 B-1).
 */
export const http: AxiosInstance = axios.create({
    baseURL: env.apiBaseUrl,
    timeout: 10_000,
    headers: {
        'Content-Type': 'application/json',
        /*
         * 계약이 **필수(O)** 로 정한 헤더입니다. `ADMIN-AUTH-001` 을 비롯한 10개 계약이
         * 전부 `Accept: application/json` 을 요청 헤더에 명시합니다.
         *
         * axios 는 기본값으로 `application/json` 뒤에 `text/plain` 과 와일드카드를 덧붙여
         * 보냅니다. 서버가 `Accept` 를 엄격히 보면 그 때문에 협상이 어긋날 수 있어서,
         * 계약에 적힌 값만 그대로 보냅니다.
         */
        Accept: 'application/json',
    },
    /**
     * 세션 쿠키를 같이 보냅니다.
     *
     * Bearer 토큰은 브라우저 영속 저장소에 둘 수 없어서(B-2) 메모리에만 있습니다.
     * 새로고침하면 사라지므로, 백엔드가 httpOnly 세션 쿠키를 함께 내려 주면
     * 그 쿠키로 `ADMIN-AUTH-003 /auth/me` 를 불러 세션을 복원합니다.
     * 쿠키가 없더라도 이 옵션은 무해합니다.
     */
    withCredentials: true,
});

/**
 * 목업 모드에서 네트워크로 새려던 요청.
 *
 * **전용 타입인 이유가 있습니다.** 그냥 `Error` 로 던지면 아래 응답 인터셉터가 이걸
 * 「서버가 응답을 못 준 경우」로 읽고 「서버에 연결하지 못했습니다」로 바꿔 버립니다.
 * 그건 정반대 안내입니다 — 서버 탓이 아니라 **우리 코드에 목업 분기가 빠진 것**이고,
 * 관리자가 아니라 개발자가 고쳐야 합니다. 그래서 이 오류만 손대지 않고 통과시킵니다.
 */
export class MockNetworkBlockedError extends Error {
    constructor(method: string | undefined, url: string | undefined) {
        super(
            `목업 모드에서 네트워크 요청이 발생했습니다: ${method?.toUpperCase() ?? 'GET'} ${url ?? '(경로 없음)'}\n` +
                '해당 api 모듈에 목업 분기가 빠졌습니다. 실 API 로 확인하려면 ' +
                '.env.development.local 에 VITE_USE_MOCK_DATA=false 를 두세요.',
        );
        this.name = 'MockNetworkBlockedError';
    }
}

/** 로그인 요청 자체는 401 이 나도 '세션 만료'가 아닙니다. 그냥 자격이 틀린 것뿐입니다. */
function isAuthEntryPoint(url: string | undefined): boolean {
    return Boolean(url && (url.includes('/auth/login') || url.includes('/auth/me')));
}

/**
 * **서버가 응답을 주지 못했을 때**의 한글 안내.
 *
 * 세 경우를 갈라 말합니다 — 관리자가 할 일이 다르기 때문입니다.
 *   요청 취소   화면을 옮기거나 조건을 바꿔 이전 요청이 버려진 것. 오류가 아닙니다.
 *   타임아웃    서버가 살아는 있는데 느립니다. 다시 눌러 볼 만합니다.
 *   연결 실패   서버가 꺼졌거나 망이 끊겼습니다. 눌러도 소용없고 백엔드에 알려야 합니다.
 *
 * axios 의 영문 문구(`Network Error`·`timeout of 10000ms exceeded`)를 그대로 쓰면
 * 셋이 구분되지도 않고, 관리자가 자기 잘못으로 읽습니다.
 */
function offlineMessageOf(error: AxiosError<unknown>): string {
    if (error.code === 'ERR_CANCELED') return '요청이 취소되었습니다.';
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return '서버 응답이 너무 늦습니다. 잠시 후 다시 시도해 주세요.';
    }
    // 응답 자체가 없으면(`error.response` 부재) 서버에 닿지 못한 것입니다.
    if (!error.response) return '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';

    // 응답은 왔는데 본문에 메시지가 없는 경우 — 상태코드는 화면이 따로 보여 줍니다.
    return '요청 처리 중 오류가 발생했습니다.';
}

http.interceptors.request.use((config) => {
    /*
     * **전목업 모드에서는 요청을 아예 내보내지 않습니다.**
     *
     * 목업 분기는 각 api 모듈 안에 흩어져 있어서(`stationsApi`·`inspectionsApi`·`authApi`),
     * 한 곳만 빠뜨려도 조용히 네트워크로 샙니다. 실제로 그런 적이 있습니다 — 지금은
     * 지운 `historyApi` 에는 `env.useMockData` 분기가 아예 없었습니다.
     *
     * 그래서 마지막 관문을 여기에 둡니다. 목업으로 돌리는 동안에는 무엇이 새든 이 줄에서
     * 죽고, 브라우저 네트워크 탭에 요청이 **뜨지도 않습니다**. dev 프록시도 기본으로
     * 꺼 두었으니(`vite.config.ts`) 파이프와 마개를 둘 다 잠근 셈입니다.
     *
     * 두 플래그가 모두 켜졌을 때만 막습니다. 하나만 내려 둔 경우는 "그 부분만 실 API 로
     * 확인하겠다"는 뜻이라 통과시킵니다.
     */
    if (import.meta.env.DEV && env.useMockData && env.mockAuth) {
        throw new MockNetworkBlockedError(config.method, config.url);
    }

    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // 모든 외부 요청에 붙입니다. 서버 오류 응답의 meta.requestId 와 짝이 됩니다.
    config.headers['X-Request-Id'] = newRequestId();
    return config;
});

http.interceptors.response.use(
    (response) => {
        response.data = unwrapEnvelope(response.data);
        return response;
    },
    (error: AxiosError<unknown>) => {
        /*
         * 목업 차단은 통신 실패가 아니라 **우리 코드의 결함**입니다. 아래 변환을 태우면
         * 「서버에 연결하지 못했습니다」가 되어 진짜 원인이 지워지므로 그대로 올립니다.
         */
        if (error instanceof MockNetworkBlockedError) return Promise.reject(error);

        const status = error.response?.status ?? 0;
        const { code, message } = readApiError(error.response?.data);
        const url = error.config?.url;

        /*
         * 세션이 끊긴 경우에만 로컬 상태를 비웁니다.
         *
         * 예전에는 401 이면 무조건 clearAuth 를 불렀는데, 그러면 로그인 실패(자격 틀림)에도
         * 세션 정리가 돌아 로그인 화면이 "세션이 만료되었습니다"를 띄웁니다.
         * 아직 로그인한 적도 없는데요.
         */
        if (status === 401 && !isAuthEntryPoint(url)) {
            useAuthStore.getState().clearAuth();
        }

        return Promise.reject(
            new ApiRequestError({
                /*
                 * **서버 메시지가 있으면 그대로, 없으면 우리가 한글로 말합니다.**
                 *
                 * 예전에는 `message || error.message` 였습니다. 서버가 응답을 아예 주지
                 * 않으면(꺼짐·네트워크 끊김·타임아웃) 서버 메시지가 없으니 axios 의 것이
                 * 나오는데, 그게 영문 기술 문구입니다.
                 *   `Network Error`
                 *   `timeout of 10000ms exceeded`
                 * 관리자 화면에 그대로 떠서 "내가 뭘 잘못했나" 로 읽힙니다. 실제로는
                 * **서버 쪽 문제**라 조치가 정반대입니다(기다리거나 백엔드에 알리기).
                 *
                 * 서버가 준 메시지는 손대지 않습니다 — 한글이고, 그쪽이 더 정확합니다
                 * (예: 500 은 「일시적인 오류가 발생했습니다.」를 직접 보내 줍니다).
                 */
                message: message || offlineMessageOf(error),
                statusCode: status,
                code,
                path: url,
            }),
        );
    },
);
