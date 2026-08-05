import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { useLayoutEffect, useState } from 'react'
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

// 항목별 시각은 절대 날짜 대신 상대 시간으로 표시(2026-08-05 사용자 확인) — 12개월까지는
// 개월 단위로 세고, 그 이상은 전부 "1년 전"으로 뭉뚱그린다(사용자가 지정한 단계 그대로).
function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000))
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  if (diffMinutes < 1) return '방금 전'
  if (diffMinutes < 60) return `${diffMinutes}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays === 1) return '어제'
  if (diffDays < 30) return `${diffDays}일 전`

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths}개월 전`
  return '1년 전'
}

interface DayGroup {
  key: string
  label: string
  items: AlertItem[]
}

// 발생일(occurredAt) 기준 "YYYY년 M월 D일"로 하루씩 묶는다. 오늘 날짜인 그룹만 "오늘"로 표시
// (2026-08-05 사용자 확인). alertApi.ts의 Mock 목록이 이미 최신순이라 그룹 내부 순서는 별도
// 정렬 없이도 최신순 그대로 유지된다.
function groupByDay(items: AlertItem[]): DayGroup[] {
  const groups: DayGroup[] = []
  const groupByKey = new Map<string, DayGroup>()
  const today = new Date()

  for (const item of items) {
    const date = new Date(item.occurredAt)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

    let group = groupByKey.get(key)
    if (!group) {
      const isToday =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()

      group = {
        key,
        label: isToday ? '오늘' : `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`,
        items: [],
      }
      groupByKey.set(key, group)
      groups.push(group)
    }
    group.items.push(item)
  }

  return groups
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

  const markAllRead = () => {
    if (!alertsQuery.data) return
    setReadKeys(new Set(alertsQuery.data.map((item) => item.alertKey)))
  }

  // 헤더 오른쪽 "모두 읽음" 버튼 — 로컬 state(markAllRead)를 참조해야 해서 RootStackNavigator의
  // options가 아니라 화면 안에서 setOptions로 등록한다.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={markAllRead}
          hitSlop={8}
          style={{ borderWidth: 0, backgroundColor: 'transparent' }}
        >
          <Text className="text-base font-semibold text-text">모두 읽음</Text>
        </Pressable>
      ),
    })
  }, [navigation, alertsQuery.data])

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
  const dayGroups = groupByDay(items)

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
          <View className="mt-16 items-center gap-3 px-6">
            <Text className="text-lg font-bold text-text">새로운 알림이 없어요</Text>
            <Text className="text-center text-base text-text-secondary">
              대여·반납·미정산 관련 알림이 오면{'\n'}여기서 확인할 수 있어요
            </Text>
          </View>
        )}

        {dayGroups.map((group) => (
          <View key={group.key} className="gap-3">
            <Text className="text-sm font-bold text-text-secondary">{group.label}</Text>

            {group.items.map((item) => {
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
                    className={`relative rounded-2xl p-4 active:opacity-80 ${
                      isRead ? 'bg-white' : 'bg-secondary'
                    }`}
                  >
                    {!isRead && (
                      <View className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary" />
                    )}
                    <View className="gap-1 pr-4">
                      <Text className="text-sm font-bold text-text">{item.title}</Text>
                      <Text className="text-sm text-text-secondary">{item.message}</Text>
                      <Text className="text-xs text-text-secondary">{formatRelativeTime(item.occurredAt)}</Text>
                    </View>
                  </Pressable>
                </Swipeable>
              )
            })}
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}
