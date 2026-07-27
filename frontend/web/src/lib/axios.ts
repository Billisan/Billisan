import axios, { AxiosError, type AxiosInstance } from 'axios';

import { env } from '@/config/env';
import { ApiRequestError } from '@/lib/api-error';
import { getAccessToken, useAuthStore } from '@/features/auth/stores/authStore';
import type { ApiResponse } from '@/shared/types/api';

/**
 * 공용 Axios 인스턴스.
 *  - 요청: Authorization 헤더에 Bearer 토큰 자동 첨부
 *  - 응답: 백엔드 공통 응답에서 data 만 언랩해서 반환
 *  - 실패: ApiRequestError 로 변환해 throw (401 이면 로그아웃 처리)
 */
export const http: AxiosInstance = axios.create({
    baseURL: env.apiBaseUrl,
    timeout: 10_000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 요청 인터셉터: 토큰 첨부
http.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 응답 인터셉터: 공통 응답 언랩 + 에러 정규화
http.interceptors.response.use(
    (response) => {
        const body = response.data as ApiResponse<unknown>;
        // 공통 규격이면 data 만 꺼내서 반환. 규격을 안 따르는 응답은 원본 유지.
        if (body && typeof body === 'object' && 'data' in body && 'statusCode' in body) {
            response.data = body.data;
        }
        return response;
    },
    (error: AxiosError<ApiResponse<unknown>>) => {
        const status = error.response?.status ?? 0;

        // 인증 만료/실패 → 로컬 인증 상태 정리
        if (status === 401) {
            useAuthStore.getState().clearAuth();
        }

        const body = error.response?.data;
        const message =
            (body && typeof body === 'object' && 'message' in body && body.message) ||
            error.message ||
            '요청 처리 중 오류가 발생했습니다.';

        return Promise.reject(
            new ApiRequestError({
                message: String(message),
                statusCode: status,
                path: error.config?.url,
                error: body && typeof body === 'object' ? body.error : undefined,
            }),
        );
    },
);
