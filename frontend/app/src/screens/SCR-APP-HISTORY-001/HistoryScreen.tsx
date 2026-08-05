import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { getHomeSummary } from '../../api/homeApi'
import { getRentalHistory } from '../../api/historyApi'
import { Button } from '../../components/common/Button'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { AppHeader } from '../../components/layout/AppHeader'
import { Screen } from '../../components/layout/Screen'
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
  const [filter, setFilter] = useState<HistoryStatusFilter>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 마이페이지와 동일하게 알림 배지는 HOME-001을 재사용(전용 API 새로 안 만듦, 2026-08-04 결정 그대로).
  const headerQuery = useQuery({ queryKey: ['history-header'], queryFn: getHomeSummary })
  const historyQuery = useQuery({
    queryKey: ['history', filter],
    queryFn: () => getRentalHistory({ status: filter }),
  })

  if (historyQuery.isPending) {
    return <LoadingScreen />
  }

  if (historyQuery.isError || !historyQuery.data) {
    return (
      <Screen>
        <View className="mt-10 gap-4 px-6">
          <ErrorBanner message="이용 내역을 불러오지 못했어요" />
          <Button label="다시 시도" onPress={() => historyQuery.refetch()} />
        </View>
      </Screen>
    )
  }

  const items = historyQuery.data.items
  const monthGroups = groupByMonth(items)

  return (
    <Screen edges={['right', 'bottom', 'left']}>
      <AppHeader
        schoolName={headerQuery.data?.user.schoolName ?? ''}
        alertCount={headerQuery.data?.alertCount ?? 0}
      />
      <View className="mb-4 flex-row gap-2 px-6 pt-4">
        {FILTERS.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setFilter(item.value)}
            className={`rounded-full px-3 py-2 active:opacity-70 ${
              filter === item.value ? 'bg-primary' : 'border border-disabled'
            }`}
          >
            <Text
              className={`text-xs font-bold ${filter === item.value ? 'text-text' : 'text-text-secondary'}`}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-6 pb-24 pt-2"
        refreshControl={
          <RefreshControl refreshing={historyQuery.isRefetching} onRefresh={() => historyQuery.refetch()} />
        }
      >
        {items.length === 0 && (
          <Text className="mt-10 text-center text-sm text-text-secondary">{EMPTY_MESSAGE[filter]}</Text>
        )}

        {monthGroups.map((group) => (
          <HistoryMonthGroup
            key={group.key}
            monthLabel={group.label}
            items={group.items}
            expandedId={expandedId}
            onToggleExpand={(rentalId) => setExpandedId((prev) => (prev === rentalId ? null : rentalId))}
          />
        ))}
      </ScrollView>
    </Screen>
  )
}
