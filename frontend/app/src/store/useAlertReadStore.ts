import { create } from 'zustand'

interface AlertReadState {
  readKeys: Set<string>
  markRead: (alertKey: string) => void
  markAllRead: (alertKeys: string[]) => void
  reset: () => void
}

// 알림 읽음 상태는 서버에 영속하지 않는 세션 전용 클라이언트 state다(DEC-SF-008,
// ALERT-002는 여전히 DEFERRED_NOT_CONTRACTED). NotificationScreen 로컬 state가 아니라
// 전역 스토어로 두는 이유는 홈/마이페이지/내역 헤더(AppHeader)의 알림 배지가 여기서 읽은
// 개수만큼 줄어들게 하기 위함(2026-08-09 사용자 확인) — 헤더의 alertCount는 HOME-001이 주는
// 서버 계산값이라 정확히 1:1 대응하진 않고, "읽은 개수만큼 차감"하는 근사치로만 반영한다.
export const useAlertReadStore = create<AlertReadState>((set) => ({
  readKeys: new Set(),
  markRead: (alertKey) => set((state) => ({ readKeys: new Set(state.readKeys).add(alertKey) })),
  markAllRead: (alertKeys) => set({ readKeys: new Set(alertKeys) }),
  reset: () => set({ readKeys: new Set() }),
}))
