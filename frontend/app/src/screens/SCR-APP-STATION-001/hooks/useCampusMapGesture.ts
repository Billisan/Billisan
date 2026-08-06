import { useRef } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import {
  CAMPUS_MAP_SVG_HEIGHT,
  CAMPUS_MAP_SVG_WIDTH,
  computeSafeFillScale,
  toContainedMapPoint,
} from '../mapGeometry'

// 안전 배율(모든 대여소가 화면에 들어오는 선에서 여백을 최소화하는 배율) 대비, pinch로 추가로
// 더 확대할 수 있는 배수.
const ZOOM_RANGE = 3

function clamp(value: number, min: number, max: number) {
  'worklet'
  return Math.min(max, Math.max(min, value))
}

interface UseCampusMapGestureOptions {
  // 지도에 표시되는 모든 대여소 좌표(0~1 비율) — 최소 배율(안전 배율) 계산에 쓰인다.
  stations: { x: number; y: number }[]
  // 최초 렌더 시 안전 배율 대비 추가로 확대할 배수(1이면 안전 배율 그대로 시작).
  initialFocusScaleMultiplier?: number
  // 최초 렌더 시 화면 중앙에 오도록 맞출 지도 기준점(0~1 비율 좌표).
  initialFocus?: { x: number; y: number }
}

// Pinch(안전 배율~3배) + Pan(이동 범위 제한) 제스처. 줌/팬 상태는 React state가 아니라 reanimated
// shared value로만 관리해 리렌더 없이 트랜스폼만 갱신한다(PLAN §3 — 스펙 §7 "확대/축소 상태는
// 지도 컴포넌트 내부에서 관리" + §9 "불필요한 리렌더링 최소화").
//
// 지도 SVG(912x1300)와 화면 비율이 다르면 "전체 보기"는 위아래(또는 좌우)에 여백이 남는다.
// 최소 배율을 고정값으로 두지 않고, 등록된 모든 대여소가 화면 밖으로 잘리지 않는 한도 내에서
// 여백을 최소화하는 배율(computeSafeFillScale)을 매 레이아웃마다 계산해 최소 배율로 쓴다
// (2026-08-06 사용자 확인 — "양옆은 다 나와야 하는데 위아래는 여백까지 나와, 잘라줘").
export function useCampusMapGesture({
  stations,
  initialFocusScaleMultiplier = 1,
  initialFocus,
}: UseCampusMapGestureOptions) {
  const containerWidth = useSharedValue(0)
  const containerHeight = useSharedValue(0)
  const hasAppliedInitialFocus = useRef(false)

  const minScale = useSharedValue(1)
  const maxScale = useSharedValue(ZOOM_RANGE)
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, minScale.value, maxScale.value)
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
    const { width, height } = event.nativeEvent.layout
    containerWidth.value = width
    containerHeight.value = height
    if (width === 0 || height === 0) return

    // SVG 자체가 preserveAspectRatio="meet"로 컨테이너 안에 맞춰지는 배율(meetScale=1 기준점) 대비,
    // 여백을 최소화하는 안전 배율이 몇 배 확대인지 계산해 최소 배율로 쓴다.
    const meetScale = Math.min(width / CAMPUS_MAP_SVG_WIDTH, height / CAMPUS_MAP_SVG_HEIGHT)
    const safeFillScale = computeSafeFillScale(width, height, stations)
    const nextMinScale = meetScale > 0 ? safeFillScale / meetScale : 1
    minScale.value = nextMinScale
    maxScale.value = nextMinScale * ZOOM_RANGE

    if (scale.value < nextMinScale) {
      scale.value = nextMinScale
      savedScale.value = nextMinScale
    }

    if (!hasAppliedInitialFocus.current) {
      hasAppliedInitialFocus.current = true

      const clampedScale = clamp(nextMinScale * initialFocusScaleMultiplier, nextMinScale, maxScale.value)
      const maxOffsetX = (width * (clampedScale - 1)) / 2
      const maxOffsetY = (height * (clampedScale - 1)) / 2
      const focusPoint = initialFocus
        ? toContainedMapPoint(width, height, initialFocus.x, initialFocus.y)
        : null
      const targetX = focusPoint
        ? clamp(-clampedScale * (focusPoint.x - width / 2), -maxOffsetX, maxOffsetX)
        : 0
      const targetY = focusPoint
        ? clamp(-clampedScale * (focusPoint.y - height / 2), -maxOffsetY, maxOffsetY)
        : 0

      scale.value = clampedScale
      savedScale.value = clampedScale
      translateX.value = targetX
      translateY.value = targetY
      savedTranslateX.value = targetX
      savedTranslateY.value = targetY
    }
  }

  return {
    composedGesture,
    animatedStyle,
    onContainerLayout,
    // 마커 레이어가 지도와 별도로 위치만 따라가도록(크기는 고정) 직접 참조하는 shared value.
    scale,
    translateX,
    translateY,
    containerWidth,
    containerHeight,
  }
}
