import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import type { Station } from '../../types/station'

const OPEN_DURATION_MS = 320
const CLOSE_DURATION_MS = 240
const SHEET_TRAVEL_DISTANCE = 240

interface StationBottomSheetProps {
  station: Station | null
  onClose: () => void
}

// 새 라이브러리 없이 직접 구현한 Bottom Sheet — INT-APP-005(PROJECT_GUIDE.md §9.1) 규격 재사용
// (open 320ms/close 240ms). 마커 탭 시 나오는 이 시트가 대여소 상세 정보의 전부이며, 별도
// SCR-APP-STATION-DETAIL-001 화면은 만들지 않는다(PLAN §1, 2026-08-05 사용자 확인).
export function StationBottomSheet({ station, onClose }: StationBottomSheetProps) {
  const progress = useSharedValue(0)
  // station이 닫히는 순간 바로 null이 되면 닫힘 애니메이션이 재생될 시간이 없어서, 애니메이션이
  // 끝난 뒤에만 실제로 언마운트하도록 별도 state로 마지막 값을 붙잡아둔다.
  const [renderedStation, setRenderedStation] = useState<Station | null>(null)

  useEffect(() => {
    if (station) {
      setRenderedStation(station)
      progress.value = withTiming(1, { duration: OPEN_DURATION_MS })
    } else {
      progress.value = withTiming(0, { duration: CLOSE_DURATION_MS }, (finished) => {
        if (finished) {
          runOnJS(setRenderedStation)(null)
        }
      })
    }
  }, [station, progress])

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * SHEET_TRAVEL_DISTANCE }],
    opacity: progress.value,
  }))

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.4,
  }))

  if (!renderedStation) {
    return null
  }

  return (
    <>
      <Animated.View
        style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000' }, backdropStyle]}
      >
        <Pressable className="flex-1" onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            gap: 8,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: '#FFFFFF',
            padding: 24,
          },
          sheetStyle,
        ]}
      >
        <View className="mb-2 h-1 w-10 self-center rounded-full bg-disabled" />
        <Text className="text-lg font-bold text-text">{renderedStation.name}</Text>
        <Text className="text-sm text-text-secondary">대여 가능한 우산</Text>
        <Text className="text-2xl font-bold text-text">{renderedStation.availableCount}개</Text>
        {renderedStation.description && (
          <Text className="mt-2 text-sm text-text-secondary">{renderedStation.description}</Text>
        )}
      </Animated.View>
    </>
  )
}
