import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { getAlerts } from '../../api/alertApi'
import { Button } from '../../components/common/Button'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { Screen } from '../../components/layout/Screen'
import type { RootStackParamList } from '../../navigation/RootStackNavigator'
import type { AlertItem } from '../../types/alert'
import { ALERT_ACTION_TYPE } from '../../types/alert'

function formatOccurredAt(value: string) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours24 = date.getHours()
  const period = hours24 < 12 ? '오전' : '오후'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${period} ${hours12}:${minutes}`
}

// SCR-APP-NOTIFICATION-001(app-screen-flow.md §2.7). 서버 영속 읽음 저장(ALERT-002)은
// DEFERRED_NOT_CONTRACTED — 읽음 상태는 이 컴포넌트의 로컬 state에만 유지, 새로고침 시 초기화된다.
export function NotificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set())

  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: getAlerts })

  const markRead = (alertKey: string) => {
    setReadKeys((prev) => new Set(prev).add(alertKey))
  }

  const handlePress = (item: AlertItem) => {
    markRead(item.alertKey)
    if (item.action.type === ALERT_ACTION_TYPE.OPEN_MY_PAGE) {
      navigation.navigate('Tabs', { screen: 'MyPage', params: { screen: 'MyPageHome' } })
      return
    }
    if (item.action.type === ALERT_ACTION_TYPE.OPEN_HISTORY) {
      navigation.navigate('Tabs', { screen: 'History' })
    }
  }

  if (alertsQuery.isPending) {
    return <LoadingScreen />
  }

  if (alertsQuery.isError || !alertsQuery.data) {
    return (
      <Screen background="white">
        <View className="mt-10 gap-4 px-6">
          <ErrorBanner message="알림을 불러오지 못했어요" />
          <Button label="다시 시도" onPress={() => alertsQuery.refetch()} />
        </View>
      </Screen>
    )
  }

  const items = alertsQuery.data

  return (
    <Screen background="white">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-6 py-6"
        refreshControl={
          <RefreshControl refreshing={alertsQuery.isRefetching} onRefresh={() => alertsQuery.refetch()} />
        }
      >
        {items.length === 0 && (
          <Text className="mt-10 text-center text-sm text-text-secondary">알림이 없어요</Text>
        )}

        {items.map((item) => {
          const isRead = readKeys.has(item.alertKey)

          return (
            <Swipeable
              key={item.alertKey}
              renderRightActions={(_progress, _translation, swipeableMethods) => (
                <Pressable
                  onPress={() => {
                    markRead(item.alertKey)
                    swipeableMethods.close()
                  }}
                  className="ml-2 items-center justify-center rounded-2xl bg-primary px-5 active:opacity-80"
                >
                  <Text className="text-sm font-bold text-text">읽음</Text>
                </Pressable>
              )}
            >
              <Pressable
                onPress={() => handlePress(item)}
                className={`flex-row gap-3 rounded-2xl p-4 active:opacity-80 ${
                  isRead ? 'bg-white' : 'bg-secondary'
                }`}
              >
                {!isRead && <View className="mt-1.5 h-2 w-2 rounded-full bg-primary" />}
                <View className="flex-1 gap-1">
                  <Text className="text-sm font-bold text-text">{item.title}</Text>
                  <Text className="text-sm text-text-secondary">{item.message}</Text>
                  <Text className="text-xs text-text-secondary">{formatOccurredAt(item.occurredAt)}</Text>
                </View>
              </Pressable>
            </Swipeable>
          )
        })}
      </ScrollView>
    </Screen>
  )
}
