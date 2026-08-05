import { Text, View } from 'react-native'
import type { RentalHistoryItem } from '../../types/history'
import { HistoryItemCard } from './HistoryItemCard'

interface HistoryMonthGroupProps {
  monthLabel: string
  items: RentalHistoryItem[]
  expandedId: string | null
  onToggleExpand: (rentalId: string) => void
}

// 이용 내역을 "YYYY년 M월" 단위로 묶어 보여주는 섹션 하나(월 구분선 + 그 달의 카드들).
export function HistoryMonthGroup({ monthLabel, items, expandedId, onToggleExpand }: HistoryMonthGroupProps) {
  return (
    <View className="gap-3">
      <Text className="text-sm font-bold text-text-secondary">{monthLabel}</Text>
      {items.map((item) => (
        <HistoryItemCard
          key={item.rentalId}
          item={item}
          expanded={expandedId === item.rentalId}
          onPress={() => onToggleExpand(item.rentalId)}
        />
      ))}
    </View>
  )
}
