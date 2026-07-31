import type { LoginRequest, LoginResponse } from '../types/auth'

// 수동 테스트 시나리오 — MOCK_SCENARIO를 바꿔서 성공/실패 화면을 확인한다.
const MOCK_SCENARIO: 'SUCCESS' | 'INVALID_CREDENTIALS' = 'SUCCESS'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

// AUTH-001(PROJECT_GUIDE.md §5.1) 대응 Mock. 실제 네트워크 호출 없음.
export function login(request: LoginRequest): Promise<LoginResponse> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (MOCK_SCENARIO === 'INVALID_CREDENTIALS') {
        reject(new Error('INVALID_CREDENTIALS'))
        return
      }

      resolve({
        accessToken: 'mock-access-token',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        user: {
          userId: 'mock-user-ref',
          displayName: request.identifier.split('@')[0] || '사용자',
          schoolName: '빌리대학교',
          faceRegistered: false,
        },
      })
    }, delay)
  })
}

// AUTH-002(PROJECT_GUIDE.md §5.2) 대응 Mock. 실제 네트워크 호출 없음.
export function logout(): Promise<{ loggedOut: true }> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ loggedOut: true })
    }, delay)
  })
}
