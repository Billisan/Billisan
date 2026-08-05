import { useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import CampusMapSvg from '../../assets/campus-map.svg'
import type { Station } from '../../types/station'
import { useCampusMapGesture } from './hooks/useCampusMapGesture'
import { toContainedMapPoint } from './mapGeometry'
import { StationMarker } from './StationMarker'

interface CampusMapProps {
  stations: Station[]
  selectedStationId: number | null
  onSelectStation: (id: number) => void
}

// 최초 진입 시 확대해서 보여줄 기준 대여소, 안전 배율(여백 최소화 배율) 대비 배수(2026-08-06 확인).
const INITIAL_FOCUS_STATION_NAME = '공학관'
const INITIAL_FOCUS_SCALE = 2

// station.x/y는 SVG 건물 라벨과 같은 지점(건물 도형 중심)이라, 마커를 그 자리에 그대로 두면
// 라벨 글자를 덮어버린다. 마커를 라벨 위로 띄우기 위한 오프셋(scale=1 기준 화면 px, 지도의
// scale/translate 계산에 함께 들어가므로 확대해도 라벨과 겹치지 않는다, 2026-08-06 확인).
const MARKER_LABEL_OFFSET = 32

// SVG 지도 + Pinch/Pan 컨테이너. 마커는 지도(SVG)와 다른 레이어에 렌더링한다 — 위치는 지도의
// scale/translate를 따라가지만 화면상 크기는 확대/축소와 무관하게 고정된다(카카오맵/네이버맵과
// 동일한 방식, 2026-08-06 사용자 확인). 좌표는 0~1 비율이라 onLayout으로 측정한 실제 픽셀
// 크기(mapSize) 기준으로 변환한다.
export function CampusMap({ stations, selectedStationId, onSelectStation }: CampusMapProps) {
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 })
  const initialFocusStation = stations.find((station) => station.name === INITIAL_FOCUS_STATION_NAME)
  const {
    composedGesture,
    animatedStyle,
    onContainerLayout,
    scale,
    translateX,
    translateY,
    containerWidth,
    containerHeight,
  } = useCampusMapGesture({
    stations,
    initialFocusScaleMultiplier: INITIAL_FOCUS_SCALE,
    initialFocus: initialFocusStation
      ? { x: initialFocusStation.x, y: initialFocusStation.y }
      : undefined,
  })

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setMapSize({ width, height })
    onContainerLayout(event)
  }

  return (
    <View className="flex-1 overflow-hidden bg-background" onLayout={handleLayout}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          <CampusMapSvg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />
        </Animated.View>
      </GestureDetector>
      {mapSize.width > 0 &&
        mapSize.height > 0 &&
        stations.map((station) => {
          const mapPoint = toContainedMapPoint(mapSize.width, mapSize.height, station.x, station.y)

          return (
            <StationMarker
              key={station.id}
              station={station}
              mapX={mapPoint.x}
              mapY={mapPoint.y - MARKER_LABEL_OFFSET}
              scale={scale}
              translateX={translateX}
              translateY={translateY}
              containerWidth={containerWidth}
              containerHeight={containerHeight}
              selected={selectedStationId === station.id}
              onPress={() => onSelectStation(station.id)}
            />
          )
        })}
    </View>
  )
}
