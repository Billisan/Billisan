import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { getAlerts } from '../api/alertApi'
import { ensureNotificationPermission, showAlertNotification } from '../lib/notifications'
import { useAlertNotifiedStore } from '../store/useAlertNotifiedStore'

const POLL_INTERVAL_MS = 60_000

// 로그인 상태일 때만 ALERT-001을 60초마다 다시 조회해 새 alertKey가 있으면 로컬 알림 배너를
// 띄운다(2026-08-09 사용자 확인). 앱이 실행 중이어야만 동작하는 로컬 알림이라 백그라운드/완전
// 종료 상태에서는 못 띄운다 — RootNavigator.tsx에서 accessToken 유무로 enabled를 넘겨받는다.
export function useAlertPolling(enabled: boolean): void {
  const hasSeeded = useAlertNotifiedStore((state) => state.hasSeeded)
  const notifiedKeys = useAlertNotifiedStore((state) => state.notifiedKeys)
  const seed = useAlertNotifiedStore((state) => state.seed)
  const markNotified = useAlertNotifiedStore((state) => state.markNotified)
  const hasRequestedPermission = useRef(false)

  const alertsQuery = useQuery({
    queryKey: ['alerts-poll'],
    queryFn: getAlerts,
    enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
  })

  useEffect(() => {
    if (!enabled || !alertsQuery.data) return

    // 이 기기에서 처음 폴링하는 거면, 기존 알림들을 배너로 쏟아내지 않고 조용히 기준선만 세운다.
    if (!hasSeeded) {
      seed(alertsQuery.data.map((item) => item.alertKey))
      return
    }

    const newItems = alertsQuery.data.filter((item) => !notifiedKeys.has(item.alertKey))
    if (newItems.length === 0) return

    ;(async () => {
      if (!hasRequestedPermission.current) {
        hasRequestedPermission.current = true
        const granted = await ensureNotificationPermission()
        if (!granted) return
      }
      for (const item of newItems) {
        await showAlertNotification(item)
        markNotified(item.alertKey)
      }
    })()
  }, [enabled, alertsQuery.data, hasSeeded, notifiedKeys, seed, markNotified])
}
