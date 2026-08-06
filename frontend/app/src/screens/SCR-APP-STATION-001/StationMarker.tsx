import { Pressable, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg'
import type { Station } from '../../types/station'

// 물방울(핀) 모양 마커 — viewBox 32x40 기준, 원형 머리(중심 16,16 반지름16) + 아래로
// 뾰족해지는 꼬리(끝점 16,40). 꼬리 끝이 실제 대여소 좌표를 가리킨다(2026-08-06 사용자
// 레퍼런스 확인 — 카카오맵류 지도 마커와 동일한 핀 형태로 변경).
const PIN_WIDTH = 32
const PIN_HEIGHT = 40
const PIN_PATH =
  'M16 0C7.163 0 0 7.163 0 16c0 8.837 16 24 16 24s16-15.163 16-24C32 7.163 24.837 0 16 0z'
// 마커 뒤에 은은하게 번지는 glow halo 크기(2026-08-06 사용자 확인 — blur 대신 RadialGradient로
// 구현, feGaussianBlur는 플랫폼별 지원이 불안정해서 회피). 핀의 원형 머리 중심에 맞춘다.
const HALO_SIZE = 64
// 핀을 HALO_SIZE 박스 안에 배치할 때, 핀의 원형 머리 중심(로컬 y=16)이 박스 중심(y=32)에
// 오도록 하는 오프셋. 즉 핀의 로컬 좌표 y에 PIN_TOP_OFFSET을 더하면 박스 기준 좌표가 된다.
const PIN_TOP_OFFSET = HALO_SIZE / 2 - PIN_WIDTH / 2 // = 16
// 박스 기준, 핀 꼬리 끝(y=40)의 위치 — 마커 앵커(대여소 좌표)와 정확히 맞춰야 하는 지점.
const PIN_TIP_BOX_Y = PIN_TOP_OFFSET + PIN_HEIGHT // = 56
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

// 마커는 지도 확대/축소 배율만큼 커지지 않고 화면상 항상 같은 크기를 유지한다(카카오맵/
// 네이버맵과 동일한 방식, 2026-08-06 사용자 확인). 위치만 지도의 scale/translate shared
// value를 그대로 읽어 CampusMap의 Zoom 트랜스폼과 같은 공식으로 직접 계산한다.
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
      left: centerX + (mapX - centerX) * scale.value + translateX.value - HALO_SIZE / 2,
      top: centerY + (mapY - centerY) * scale.value + translateY.value - PIN_TIP_BOX_Y,
    }
  })

  const selectedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(selected ? 1.4 : 1) }],
  }))

  return (
    <Animated.View style={[{ position: 'absolute' }, positionStyle]}>
      <Animated.View style={selectedStyle}>
        <Pressable onPress={onPress} hitSlop={8}>
          <View style={{ width: HALO_SIZE, height: PIN_TIP_BOX_Y }}>
            <Svg width={HALO_SIZE} height={HALO_SIZE} style={{ position: 'absolute', top: 0, left: 0 }}>
              <Defs>
                <RadialGradient id="markerHalo" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={MARKER_COLOR} stopOpacity={0.45} />
                  <Stop offset="60%" stopColor={MARKER_COLOR} stopOpacity={0.18} />
                  <Stop offset="100%" stopColor={MARKER_COLOR} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={HALO_SIZE / 2} cy={HALO_SIZE / 2} r={HALO_SIZE / 2} fill="url(#markerHalo)" />
            </Svg>

            <Svg
              width={PIN_WIDTH}
              height={PIN_HEIGHT}
              viewBox={`0 0 ${PIN_WIDTH} ${PIN_HEIGHT}`}
              style={{
                position: 'absolute',
                left: (HALO_SIZE - PIN_WIDTH) / 2,
                top: PIN_TOP_OFFSET,
                ...(selected
                  ? { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }
                  : { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }),
              }}
            >
              <Path d={PIN_PATH} fill={MARKER_COLOR} />
            </Svg>

            <View
              style={{
                position: 'absolute',
                left: (HALO_SIZE - PIN_WIDTH) / 2,
                top: PIN_TOP_OFFSET,
                width: PIN_WIDTH,
                height: PIN_WIDTH,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 12 }}>☂</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 12, fontWeight: '700' }}>
                {station.availableCount}
              </Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}
