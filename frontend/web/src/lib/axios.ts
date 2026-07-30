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

/** 로그인 요청 자체는 401 이 나도 '세션 만료'가 아닙니다. 그냥 자격이 틀린 것뿐입니다. */
function isAuthEntryPoint(url: string | undefined): boolean {
    return Boolean(url && (url.includes('/auth/login') || url.includes('/auth/me')));
}

http.interceptors.request.use((config) => {
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
                // 서버 메시지를 그대로 씁니다. 내부 SQL·Stack Trace 는 서버가 담지 않기로 돼 있습니다(D-2).
                message: message || error.message || '요청 처리 중 오류가 발생했습니다.',
                statusCode: status,
                code,
                path: url,
            }),
        );
    },
);
