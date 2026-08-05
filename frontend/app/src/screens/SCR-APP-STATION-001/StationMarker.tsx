import { Pressable, View } from 'react-native'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import type { Station } from '../../types/station'

const MARKER_SIZE = 24

interface StationMarkerProps {
  station: Station
  left: number
  top: number
  selected: boolean
  onPress: () => void
}

// 우산 개수별 마커 색상(2026-08-05 스펙) — 앱 브랜드 primary(#FFD700)와 헷갈리지 않도록
// Tailwind 기본 팔레트의 다른 톤(yellow-500)을 쓴다.
function markerColor(availableCount: number) {
  if (availableCount >= 3) return '#22C55E'
  if (availableCount >= 1) return '#EAB308'
  return '#EF4444'
}

export function StationMarker({ station, left, top, selected, onPress }: StationMarkerProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(selected ? 1.4 : 1) }],
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: left - MARKER_SIZE / 2,
          top: top - MARKER_SIZE / 2,
        },
        animatedStyle,
      ]}
    >
      <Pressable onPress={onPress} hitSlop={8}>
        <View
          style={{
            width: MARKER_SIZE,
            height: MARKER_SIZE,
            borderRadius: MARKER_SIZE / 2,
            backgroundColor: markerColor(station.availableCount),
            borderWidth: 2,
            borderColor: '#FFFFFF',
            ...(selected
              ? {
                  shadowColor: '#000',
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 4,
                }
              : null),
          }}
        />
      </Pressable>
    </Animated.View>
  )
}
