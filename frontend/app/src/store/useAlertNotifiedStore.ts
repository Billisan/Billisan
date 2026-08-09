import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface AlertNotifiedState {
  notifiedKeys: Set<string>
  hasSeeded: boolean
  seed: (alertKeys: string[]) => void
  markNotified: (alertKey: string) => void
}

// "이미 로컬 배너로 알려준 alertKey" 기록 — useAlertReadStore(앱 안에서 읽었는지 여부)와는 다른
// 관심사라 별도 스토어로 분리(2026-08-09). 기기 로컬에만 영속(서버 전송 없음).
// 이 기능이 처음 생겼을 때 이미 존재하던 알림들을 한꺼번에 배너로 쏟아내지 않도록, 첫 폴링
// 결과는 seed()로 조용히 notifiedKeys에만 채워 넣고(배너 없음), 그 이후 폴링에서 새로 생긴
// alertKey만 실제로 배너를 띄운다(useAlertPolling.ts 참고).
export const useAlertNotifiedStore = create<AlertNotifiedState>()(
  persist(
    (set) => ({
      notifiedKeys: new Set(),
      hasSeeded: false,
      seed: (alertKeys) => set({ notifiedKeys: new Set(alertKeys), hasSeeded: true }),
      markNotified: (alertKey) =>
        set((state) => ({ notifiedKeys: new Set(state.notifiedKeys).add(alertKey) })),
    }),
    {
      name: 'alert-notified-keys',
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
