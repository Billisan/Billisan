import type { LayoutChangeEvent } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

const MIN_SCALE = 1
const MAX_SCALE = 3

function clamp(value: number, min: number, max: number) {
  'worklet'
  return Math.min(max, Math.max(min, value))
}

// Pinch(1~3배) + Pan(이동 범위 제한) 제스처. 줌/팬 상태는 React state가 아니라 reanimated
// shared value로만 관리해 리렌더 없이 트랜스폼만 갱신한다(PLAN §3 — 스펙 §7 "확대/축소 상태는
// 지도 컴포넌트 내부에서 관리" + §9 "불필요한 리렌더링 최소화").
export function useCampusMapGesture() {
  const containerWidth = useSharedValue(0)
  const containerHeight = useSharedValue(0)

  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, MIN_SCALE, MAX_SCALE)
    })
    .onEnd(() => {
      savedScale.value = scale.value

      const maxOffsetX = (containerWidth.value * (scale.value - 1)) / 2
      const maxOffsetY = (containerHeight.value * (scale.value - 1)) / 2
      const clampedX = clamp(translateX.value, -maxOffsetX, maxOffsetX)
      const clampedY = clamp(translateY.value, -maxOffsetY, maxOffsetY)

      translateX.value = withTiming(clampedX)
      translateY.value = withTiming(clampedY)
      savedTranslateX.value = clampedX
      savedTranslateY.value = clampedY
    })

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const maxOffsetX = (containerWidth.value * (scale.value - 1)) / 2
      const maxOffsetY = (containerHeight.value * (scale.value - 1)) / 2
      translateX.value = clamp(savedTranslateX.value + event.translationX, -maxOffsetX, maxOffsetX)
      translateY.value = clamp(savedTranslateY.value + event.translationY, -maxOffsetY, maxOffsetY)
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  const onContainerLayout = (event: LayoutChangeEvent) => {
    containerWidth.value = event.nativeEvent.layout.width
    containerHeight.value = event.nativeEvent.layout.height
  }

  return { composedGesture, animatedStyle, onContainerLayout }
}
