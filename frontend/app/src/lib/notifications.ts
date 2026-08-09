import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { AlertItem } from '../types/alert'

const ANDROID_CHANNEL_ID = 'alerts'

// 앱이 실행 중일 때 새 알림(ALERT-001)을 감지하면 로컬 배너로 띄운다(2026-08-09 사용자 확인) —
// 서버 푸시(FCM/APNs)가 아니라 순수 로컬 알림이라 앱이 완전히 꺼진 상태에선 동작하지 않는다.
// 포그라운드에서도 배너가 뜨도록 핸들러를 모듈 로드 시 1회 등록.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // Android 13+는 알림 채널이 미리 있어야 권한 프롬프트 자체가 뜬다(Expo 공식 문서, SDK 54 확인).
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: '빌리산 알림',
      importance: Notifications.AndroidImportance.MAX,
    })
  }

  const existing = await Notifications.getPermissionsAsync()
  if (existing.status === 'granted') return true

  const requested = await Notifications.requestPermissionsAsync()
  return requested.status === 'granted'
}

export async function showAlertNotification(item: AlertItem): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: item.title, body: item.message },
    // Android는 trigger:null로는 채널을 지정할 수 없어(§Android 채널 지정은 trigger 쪽 필드),
    // 1초 뒤 TIME_INTERVAL 트리거로 채널을 명시(사실상 즉시). iOS는 채널 개념이 없어 null 유지.
    trigger:
      Platform.OS === 'android'
        ? {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1,
            channelId: ANDROID_CHANNEL_ID,
          }
        : null,
  })
}
