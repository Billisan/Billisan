import { useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import CampusMapSvg from '../../assets/campus-map.svg'
import type { Station } from '../../types/station'
import { useCampusMapGesture } from './hooks/useCampusMapGesture'
import { StationMarker } from './StationMarker'

interface CampusMapProps {
  stations: Station[]
  selectedStationId: number | null
  onSelectStation: (id: number) => void
}

// SVG 지도 + Pinch/Pan 컨테이너. 마커도 이 컴포넌트 안, 지도와 같은 Zoom 트랜스폼 레이어에
// 렌더링한다(스펙 §9 "SVG와 마커는 같은 Zoom Container 안에 배치"). 좌표는 0~1 비율이라
// onLayout으로 측정한 실제 픽셀 크기(mapSize) 기준으로 변환한다.
export function CampusMap({ stations, selectedStationId, onSelectStation }: CampusMapProps) {
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 })
  const { composedGesture, animatedStyle, onContainerLayout } = useCampusMapGesture()

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setMapSize({ width, height })
    onContainerLayout(event)
  }

  return (
    <View className="flex-1 overflow-hidden bg-background" onLayout={handleLayout}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          <CampusMapSvg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
          {mapSize.width > 0 &&
            mapSize.height > 0 &&
            stations.map((station) => (
              <StationMarker
                key={station.id}
                station={station}
                left={mapSize.width * station.x}
                top={mapSize.height * station.y}
                selected={selectedStationId === station.id}
                onPress={() => onSelectStation(station.id)}
              />
            ))}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}
