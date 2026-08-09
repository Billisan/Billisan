import { Pressable, Text, View } from 'react-native'
import { cardShadow } from '../../lib/cardShadow'
import type { RentalHistoryItem } from '../../types/history'
import { RENTAL_STATUS } from '../../types/rental'

function formatDateTime(value: string) {
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

// §9.2(상태 Chip 표시 규칙) — 새 RentalStatus Enum을 만들지 않고 기존 status·dueAt만으로 판정한다.
function statusChip(item: RentalHistoryItem): { label: string; bgClass: string; textClass: string } {
  if (item.status === RENTAL_STATUS.LOST) {
    return { label: '분실·파손', bgClass: 'bg-rose-100', textClass: 'text-rose-800' }
  }
  if (item.status === RENTAL_STATUS.CANCELLED) {
    return { label: '취소됨', bgClass: 'bg-background', textClass: 'text-text-secondary' }
  }
  if (item.status === RENTAL_STATUS.COMPLETED) {
    return { label: '반납완료', bgClass: 'bg-green-100', textClass: 'text-green-700' }
  }
  if (item.status === RENTAL_STATUS.ACTIVE || item.status === RENTAL_STATUS.RETURNING) {
    const overdue = new Date(item.dueAt).getTime() < Date.now()
    return overdue
      ? { label: '연체중', bgClass: 'bg-error-bg', textClass: 'text-error-text' }
      : { label: '대여중', bgClass: 'bg-rented-bg', textClass: 'text-rented-text' }
  }
  if (item.status === RENTAL_STATUS.FAILED) {
    return { label: '취소됨', bgClass: 'bg-background', textClass: 'text-text-secondary' }
  }
  // §9.2 표에 없는 그 외 status는 원문 그대로 표시(새 Enum 추가 금지).
  return { label: item.status, bgClass: 'bg-background', textClass: 'text-text-secondary' }
}

function settlementBadge(item: RentalHistoryItem) {
  if (item.settlementStatus === 'PENDING') {
    return { label: `미정산 ${item.settlementAmount.toLocaleString('ko-KR')}원`, isPending: true }
  }
  if (item.settlementStatus === 'PAID') {
    return { label: `정산완료 ${item.settlementAmount.toLocaleString('ko-KR')}원`, isPending: false }
  }
  return null
}

interface HistoryItemCardProps {
  item: RentalHistoryItem
  expanded: boolean
  onPress: () => void
}

// SCR-APP-HISTORY-001의 CARD_EXPANDED Variant — 카드 하나(상태 Chip·정산 뱃지·탭 시 펼침).
export function HistoryItemCard({ item, expanded, onPress }: HistoryItemCardProps) {
  const chip = statusChip(item)
  const settlement = settlementBadge(item)

  return (
    <Pressable
      onPress={onPress}
      className="gap-3 rounded-2xl bg-white p-5 active:opacity-90"
      style={cardShadow}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-base font-bold text-text">
          {item.checkoutStationName}
          {item.returnStationName ? ` → ${item.returnStationName}` : ''}
        </Text>
        <View className={`rounded-full px-3 py-1 ${chip.bgClass}`}>
          <Text className={`text-xs font-bold ${chip.textClass}`}>{chip.label}</Text>
        </View>
      </View>

      <Text className="text-sm text-text-secondary">
        {formatDateTime(item.rentedAt)} ~ {item.endedAt ? formatDateTime(item.endedAt) : '대여중'}
      </Text>

      {settlement && (
        <Text
          className={`text-sm font-bold ${settlement.isPending ? 'text-error-text' : 'text-text-secondary'}`}
        >
          {settlement.label}
        </Text>
      )}

      {expanded && (
        <View className="gap-1 border-t border-disabled pt-3">
          <Text className="text-xs text-text-secondary">반납 기한: {formatDateTime(item.dueAt)}</Text>
          {item.failureCode && (
            <Text className="text-xs text-error-text">
              실패 사유: {item.failureCode}
              {item.failedAt ? ` (${formatDateTime(item.failedAt)})` : ''}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  )
}
