import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface AlertReadState {
  readKeys: Set<string>
  markRead: (alertKey: string) => void
  markAllRead: (alertKeys: string[]) => void
  pruneToKnownKeys: (alertKeys: string[]) => void
}

// 알림 읽음 상태는 서버에 영속하지 않는다(DEC-SF-008, ALERT-002 여전히
// DEFERRED_NOT_CONTRACTED) — 대신 기기 로컬(AsyncStorage)에만 저장해 앱을 껐다 켜도, 로그아웃 후
// 다시 로그인해도 유지되게 한다(2026-08-09 사용자 확인, 신규 라이브러리
// @react-native-async-storage/async-storage 설치 승인받음). 홈/마이페이지/내역 헤더(AppHeader)의
// 알림 배지는 여기서 읽은 개수만큼 줄어든다 — 헤더의 alertCount는 HOME-001이 주는 서버 계산값이라
// 정확히 1:1 대응하진 않고 근사치로만 반영한다.
// Set은 기본 JSON.stringify로 직렬화되지 않아 replacer/reviver로 배열 <-> Set을 변환한다.
export const useAlertReadStore = create<AlertReadState>()(
  persist(
    (set) => ({
      readKeys: new Set(),
      markRead: (alertKey) => set((state) => ({ readKeys: new Set(state.readKeys).add(alertKey) })),
      markAllRead: (alertKeys) => set({ readKeys: new Set(alertKeys) }),
      // 홈/지도/내역/마이페이지 헤더 배지는 서버 alertCount에서 readKeys.size를 그냥 빼기만
      // 하는 근사치라(위 주석 참고), readKeys에 이미 사라진 과거 알림 키가 계속 쌓이면 실제
      // 안읽은 알림이 있어도 배지가 0으로 깎인다(2026-08-10 확인). NotificationScreen이 최신
      // 목록을 받을 때마다 그 목록에 없는 키를 여기서 정리해 크기를 실제와 가깝게 유지한다.
      pruneToKnownKeys: (alertKeys) =>
        set((state) => {
          const known = new Set(alertKeys)
          const pruned = new Set([...state.readKeys].filter((key) => known.has(key)))
          return pruned.size === state.readKeys.size ? state : { readKeys: pruned }
        }),
    }),
    {
      name: 'alert-read-keys',
      storage: createJSONStorage(() => AsyncStorage, {
        replacer: (_key, value) => (value instanceof Set ? { __isSet: true, values: [...value] } : value),
        reviver: (_key, value) =>
          value && typeof value === 'object' && (value as { __isSet?: boolean }).__isSet
            ? new Set((value as { values: string[] }).values)
            : value,
      }),
    },
  ),
)
