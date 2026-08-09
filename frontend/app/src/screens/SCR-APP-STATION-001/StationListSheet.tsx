import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import type { Station } from '../../types/station'

type Tier = 'many' | 'less' | 'empty'
type FilterTier = 'all' | Tier

// 마커 아이콘 tier(marker-many/less/empty)와 동일한 3단계, 동일한 색상(2026-08-09 사용자 지정
// hex — primary/text-tertiary와 값이 겹쳐 토큰 재사용, 세 번째 색만 팔레트에 없어 arbitrary value).
const TIER_LABEL: Record<Tier, string> = { many: '여유', less: '부족', empty: '마감' }
const TIER_DOT_CLASS: Record<Tier, string> = {
  many: 'bg-primary',
  less: 'bg-text-tertiary',
  empty: 'bg-[#5C6B7A]',
}

function tierOf(availableCount: number): Tier {
  if (availableCount === 0) return 'empty'
  if (availableCount <= 2) return 'less'
  return 'many'
}

// 접혔을 때도 핸들+범례+필터 칩까지는 보이도록 하는 최소 높이.
const COLLAPSED_PEEK = 190
// INT-APP-005(PROJECT_GUIDE.md §9.1) Bottom Sheet 규격 재사용 — withSpring은 통통 튀는
// 느낌이 나서(2026-08-09 사용자 확인) 다른 시트와 동일하게 withTiming으로 통일.
const OPEN_DURATION_MS = 320
const CLOSE_DURATION_MS = 240

interface StationListSheetProps {
  stations: Station[]
  selectedStationId: number | null
  onSelectStation: (id: number) => void
  // Dimensions.get('window')는 하단 탭바 등을 빼지 않은 기기 전체 높이라 실제 사용 가능 영역과
  // 어긋난다(2026-08-09 실기기 확인) — MapScreen에서 onLayout으로 실측한 컨테이너 높이를 받는다.
  containerHeight: number
}

// SCR-APP-STATION-001 지도 탭 상시 노출 시트(2026-08-09 사용자 요청) — 기존
// "마커 탭 시에만 잠깐 뜨는 상세 시트"(StationBottomSheet)를 대체한다. 우산 재고 tier 범례 +
// tier 필터 칩 + 대여소 목록을 담고, 드래그로 일부 열림↔꽉 참 사이를 오간다. 마커를 탭하면
// 목록에서 해당 항목으로 스크롤+하이라이트한다(별도 상세 화면/모달 없음).
export function StationListSheet({
  stations,
  selectedStationId,
  onSelectStation,
  containerHeight,
}: StationListSheetProps) {
  const sheetHeight = containerHeight * 0.4
  const maxTranslate = sheetHeight - COLLAPSED_PEEK
  const translateY = useSharedValue(maxTranslate)
  const dragStartY = useSharedValue(0)
  const [filter, setFilter] = useState<FilterTier>('all')
  const listRef = useRef<FlatList<Station>>(null)

  const filteredStations = useMemo(() => {
    if (filter === 'all') return stations
    return stations.filter((station) => tierOf(station.availableCount) === filter)
  }, [stations, filter])

  useEffect(() => {
    if (selectedStationId == null) return
    const index = filteredStations.findIndex((station) => station.id === selectedStationId)
    if (index === -1) return
    translateY.value = withTiming(0, { duration: OPEN_DURATION_MS })
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 })
  }, [selectedStationId, filteredStations, translateY])

  const panGesture = Gesture.Pan()
    .onStart(() => {
      dragStartY.value = translateY.value
    })
    .onUpdate((event) => {
      const next = dragStartY.value + event.translationY
      translateY.value = Math.min(Math.max(next, 0), maxTranslate)
    })
    .onEnd((event) => {
      const shouldExpand = event.velocityY < -300 || translateY.value < maxTranslate / 2
      translateY.value = withTiming(shouldExpand ? 0 : maxTranslate, {
        duration: shouldExpand ? OPEN_DURATION_MS : CLOSE_DURATION_MS,
      })
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, bottom: 0, height: sheetHeight },
          sheetStyle,
        ]}
        className="rounded-t-3xl bg-white shadow-lg"
      >
        <View className="items-center pt-2">
          <View className="h-1 w-10 rounded-full bg-disabled" />
        </View>

        <View className="flex-row gap-2 px-4 pb-3 pt-3">
          {(['all', 'many', 'less', 'empty'] as FilterTier[]).map((tier) => (
            <Pressable
              key={tier}
              onPress={() => setFilter(tier)}
              className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-80 ${
                filter === tier ? 'bg-primary' : 'bg-gray-100'
              }`}
            >
              {tier !== 'all' && (
                <View
                  className={`h-2.5 w-2.5 rounded-full border border-text-secondary ${TIER_DOT_CLASS[tier]}`}
                />
              )}
              <Text
                className={`text-sm ${filter === tier ? 'font-bold text-text' : 'text-text-secondary'}`}
              >
                {tier === 'all' ? '전체' : TIER_LABEL[tier]}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          ref={listRef}
          data={filteredStations}
          keyExtractor={(item) => String(item.id)}
          onScrollToIndexFailed={() => {}}
          renderItem={({ item }) => {
            const tier = tierOf(item.availableCount)
            const isSelected = item.id === selectedStationId
            return (
              <Pressable
                onPress={() => onSelectStation(item.id)}
                className={`flex-row items-center justify-between border-b border-border px-4 py-3 ${
                  isSelected ? 'bg-secondary' : ''
                }`}
              >
                <View className="flex-shrink flex-row items-center gap-2">
                  <View className={`h-2.5 w-2.5 rounded-full ${TIER_DOT_CLASS[tier]}`} />
                  <Text className="text-sm font-medium text-text">{item.name}</Text>
                  {item.description && (
                    <Text className="flex-shrink text-xs text-text-secondary" numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}
                </View>
                <Text className="text-sm text-text-secondary">{item.availableCount}개</Text>
              </Pressable>
            )
          }}
          ListEmptyComponent={
            <Text className="px-4 py-8 text-center text-sm text-text-secondary">
              해당 조건의 대여소가 없어요
            </Text>
          }
        />
      </Animated.View>
    </GestureDetector>
  )
}
