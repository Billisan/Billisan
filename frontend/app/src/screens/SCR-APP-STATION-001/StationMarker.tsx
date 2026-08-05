import { Pressable, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import type { Station } from '../../types/station'

const MARKER_SIZE = 28
// 대여 가능 개수로 색을 구분하지 않고 전부 동일한 색으로 표시, 개수는 마커 위 숫자로만
// 표시한다(2026-08-06 사용자 확인). 지도 안 정문/북문/동문 마커와 같은 accent 톤을 쓴다.
const MARKER_COLOR = '#2F8FA6'

interface StationMarkerProps {
  station: Station
  mapX: number // onLayout 기준 픽셀 좌표(scale=1, translate=0일 때 위치)
  mapY: number
  scale: SharedValue<number>
  translateX: SharedValue<number>
  translateY: SharedValue<number>
  containerWidth: SharedValue<number>
  containerHeight: SharedValue<number>
  selected: boolean
  onPress: () => void
}

// 마커는 지도 확대/축소 배율만큼 커지지 않고 화면상 항상 같은 크기(MARKER_SIZE)를 유지한다
// (카카오맵/네이버맵과 동일한 방식, 2026-08-06 사용자 확인). 위치만 지도의 scale/translate
// shared value를 그대로 읽어 CampusMap의 Zoom 트랜스폼과 같은 공식으로 직접 계산한다.
export function StationMarker({
  station,
  mapX,
  mapY,
  scale,
  translateX,
  translateY,
  containerWidth,
  containerHeight,
  selected,
  onPress,
}: StationMarkerProps) {
  const positionStyle = useAnimatedStyle(() => {
    const centerX = containerWidth.value / 2
    const centerY = containerHeight.value / 2

    return {
      left: centerX + (mapX - centerX) * scale.value + translateX.value - MARKER_SIZE / 2,
      top: centerY + (mapY - centerY) * scale.value + translateY.value - MARKER_SIZE / 2,
    }
  })

  const selectedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(selected ? 1.4 : 1) }],
  }))

  return (
    <Animated.View style={[{ position: 'absolute' }, positionStyle]}>
      <Animated.View style={selectedStyle}>
        <Pressable onPress={onPress} hitSlop={8}>
          <View
            style={{
              width: MARKER_SIZE,
              height: MARKER_SIZE,
              borderRadius: MARKER_SIZE / 2,
              backgroundColor: MARKER_COLOR,
              borderWidth: 2,
              borderColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
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
          >
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
              {station.availableCount}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}
