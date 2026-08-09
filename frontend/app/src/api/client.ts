import axios, { type AxiosError } from 'axios'
import * as Crypto from 'expo-crypto'

const rawBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL
if (!rawBaseUrl) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL is not set')
}

// 끝 슬래시를 제거해 baseURL + '/api/v1/...' 조합 시 이중 슬래시가 생기지 않게 한다.
const baseURL = rawBaseUrl.replace(/\/+$/, '')

export const apiClient = axios.create({
  baseURL,
  headers: { Accept: 'application/json' },
})

// useAuthStore가 로그인/로그아웃/토큰 복원 시점에 호출해 현재 토큰을 알려준다.
// client.ts가 useAuthStore를 직접 import하면 순환 참조가 생기기 때문에 setter로 분리.
let currentAccessToken: string | null = null
export function setAccessToken(token: string | null): void {
  currentAccessToken = token
}

// 401(세션 만료) 발생 시 로그인 화면으로 돌려보내기 위해 useAuthStore가 등록하는 콜백.
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

const LOGIN_PATH = '/api/v1/auth/login'

apiClient.interceptors.request.use((config) => {
  config.headers.set('X-Request-Id', Crypto.randomUUID())
  if (currentAccessToken) {
    config.headers.set('Authorization', `Bearer ${currentAccessToken}`)
  }
  return config
})

// 서버 오류 코드 문자열을 Error.message로 던진다 — 기존 화면들이
// `error.message === 'INVALID_CREDENTIALS'` 식으로 비교하던 Mock 시절 계약을 그대로 유지한다.
function extractErrorCode(error: AxiosError): string {
  const data = error.response?.data as Record<string, unknown> | undefined

  if (data) {
    const nested = data.error as Record<string, unknown> | undefined
    if (typeof nested?.code === 'string') return nested.code
    if (typeof data.code === 'string') return data.code
    if (typeof data.errorCode === 'string') return data.errorCode
  }

  if (!error.response) return 'NETWORK_ERROR'
  return `HTTP_${error.response.status}`
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && error.config?.url !== LOGIN_PATH) {
      onUnauthorized?.()
    }
    return Promise.reject(new Error(extractErrorCode(error)))
  },
)
