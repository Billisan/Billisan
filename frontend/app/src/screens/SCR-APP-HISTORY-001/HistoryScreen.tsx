import { MaterialCommunityIcons } from '@expo/vector-icons'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { getHomeSummary } from '../../api/homeApi'
import { getRentalHistory } from '../../api/historyApi'
import { Button } from '../../components/common/Button'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { AppHeader } from '../../components/layout/AppHeader'
import { Screen } from '../../components/layout/Screen'
import type { RootStackParamList } from '../../navigation/RootStackNavigator'
import type { TabParamList } from '../../navigation/TabNavigator'
import { useAlertReadStore } from '../../store/useAlertReadStore'
import type { HistoryStatusFilter, RentalHistoryItem } from '../../types/history'
import { HistoryMonthGroup } from './HistoryMonthGroup'

// app-screen-flow.md §2.6 Variant 이름 + RENTAL-002(§5.6) status 쿼리 enum 그대로 5개 탭
// (2026-08-05 사용자 확인 — LOST·FAILED도 별도 탭으로 노출).
const FILTERS: { value: HistoryStatusFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '대여중' },
  { value: 'COMPLETED', label: '반납완료' },
  { value: 'LOST', label: '분실·파손' },
  { value: 'FAILED', label: '취소됨' },
]

const EMPTY_MESSAGE: Record<HistoryStatusFilter, string> = {
  ALL: '이용 내역이 없어요',
  ACTIVE: '대여중인 우산이 없어요',
  COMPLETED: '반납 완료된 이용 내역이 없어요',
  LOST: '분실·파손 내역이 없어요',
  FAILED: '실패한 이용 내역이 없어요',
}

interface MonthGroup {
  key: string
  label: string
  items: RentalHistoryItem[]
}

// 대여 시작일(rentedAt) 기준 "YYYY년 M월"로 묶는다. historyApi.ts의 MOCK_ITEMS가 이미 최신순이라
// 그룹 내부 순서는 별도 정렬 없이도 최신순 그대로 유지된다.
function groupByMonth(items: RentalHistoryItem[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  const groupByKey = new Map<string, MonthGroup>()

  for (const item of items) {
    const date = new Date(item.rentedAt)
    const key = `${date.getFullYear()}-${date.getMonth()}`

    let group = groupByKey.get(key)
    if (!group) {
      group = { key, label: `${date.getFullYear()}년 ${date.getMonth() + 1}월`, items: [] }
      groupByKey.set(key, group)
      groups.push(group)
    }
    group.items.push(item)
  }

  return groups
}

export function HistoryScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>()
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [filter, setFilter] = useState<HistoryStatusFilter>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 마이페이지와 동일하게 알림 배지는 HOME-001을 재사용(전용 API 새로 안 만듦, 2026-08-04 결정 그대로).
  // 쿼리 키를 HomeScreen.tsx와 동일한 'home'으로 둬서 캐시를 공유(2026-08-09 코드 리뷰 반영) —
  // 탭 전환 시 중복 요청 없이 캐시된 값을 바로 보여주고 백그라운드에서만 갱신.
  const headerQuery = useQuery({ queryKey: ['home'], queryFn: getHomeSummary })
  const alertReadCount = useAlertReadStore((state) => state.readKeys.size)
  // '대여중' 탭은 RETURNING(반납 시도 중)이면서 연체된 대여도 같이 보여야 해서(상태 Chip 규칙 §9.2와
  // 맞추기 위함, 2026-08-09) ACTIVE·RETURNING 두 상태를 각각 조회해 병합한다. 그 외 탭은 단일 조회.
  const historyStatuses =
    filter === 'ACTIVE' ? (['ACTIVE', 'RETURNING'] as const) : ([filter] as const)
  const historyQueries = useQueries({
    queries: historyStatuses.map((status) => ({
      queryKey: ['history', status],
      queryFn: () => getRentalHistory({ status }),
    })),
  })
  const isPending = historyQueries.some((query) => query.isPending)
  const isError = historyQueries.some((query) => query.isError || !query.data)
  const isRefetching = historyQueries.some((query) => query.isRefetching)
  const refetchAll = () => historyQueries.forEach((query) => query.refetch())

  const mergedItems = historyQueries.flatMap((query) => query.data?.items ?? [])
  // 단일 조회일 때는 서버 응답이 이미 최신순이라 그대로 두고, 두 조회를 합친 경우에만 재정렬한다.
  const items =
    historyStatuses.length === 1
      ? mergedItems
      : [...mergedItems].sort(
          (a, b) => new Date(b.rentedAt).getTime() - new Date(a.rentedAt).getTime(),
        )
  // expandedId 등 다른 state가 바뀔 때마다 전체 목록을 다시 그룹화하지 않도록, items 배열 참조가 아니라
  // rentalId 조합(원시값)이 바뀔 때만 재계산한다(2026-08-09 코드 리뷰 반영 + 병합 조회 대응).
  const itemsKey = items.map((item) => item.rentalId).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const monthGroups = useMemo(() => groupByMonth(items), [itemsKey])

  if (isPending) {
    return <LoadingScreen />
  }

  if (isError) {
    return (
      <Screen>
        <View className="mt-10 gap-4 px-6">
          <ErrorBanner message="이용 내역을 불러오지 못했어요" />
          <Button label="다시 시도" onPress={refetchAll} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen edges={['right', 'bottom', 'left']}>
      <AppHeader
        schoolName={headerQuery.data?.user.schoolName ?? ''}
        alertCount={Math.max((headerQuery.data?.alertCount ?? 0) - alertReadCount, 0)}
        onPressAlert={() => rootNavigation.navigate('Notification')}
      />
      <View className="mb-4 flex-row justify-between p-6">
        {FILTERS.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setFilter(item.value)}
            className={`rounded-full px-3 py-2 active:opacity-70 ${
              filter === item.value ? 'bg-primary' : 'border border-disabled'
            }`}
          >
            <Text
              className={`text-sm font-bold ${filter === item.value ? 'text-text' : 'text-text-secondary'}`}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-6 pb-24 pt-2"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchAll} />}
      >
        {/* 전체 필터인데도 0건이면 지금까지 대여 이력 자체가 없는 것 — 다른 필터의 빈 상태보다
            눈에 띄는 예외 화면으로 안내한다. */}
        {filter === 'ALL' && items.length === 0 && (
          <View className="mt-16 items-center gap-2 px-6">
            <Text className="text-lg font-bold text-text">아직 이용 내역이 없어요</Text>
            <Text className="mb-6 text-center text-base text-text-secondary">
              우산을 대여하면 여기에서 이용 내역을 확인할 수 있어요
            </Text>
            <Button label="대여소 찾기" onPress={() => navigation.navigate('Map')} />
          </View>
        )}

        {filter !== 'ALL' && items.length === 0 && (
          <Text className="mt-10 text-center text-base text-text-secondary">
            {EMPTY_MESSAGE[filter]}
          </Text>
        )}

        {monthGroups.map((group) => (
          <HistoryMonthGroup
            key={group.key}
            monthLabel={group.label}
            items={group.items}
            expandedId={expandedId}
            onToggleExpand={(rentalId) =>
              setExpandedId((prev) => (prev === rentalId ? null : rentalId))
            }
          />
        ))}
      </ScrollView>
    </Screen>
  )
}
