import type { MyPageProfile } from '../types/user'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

// USER-001(PROJECT_GUIDE.md §5.3) 대응 Mock. 실제 네트워크 호출 없음.
// studentNumber는 공식 응답 필드가 아니다 — types/user.ts 주석 참고.
export function getMe(): Promise<MyPageProfile> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        userId: 'mock-user-ref',
        displayName: '홍길동',
        schoolName: '빌리대학교',
        studentNumber: '1549943',
      })
    }, delay)
  })
}
