import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { View } from 'react-native'
import { getStations } from '../../api/stationApi'
import { Button } from '../../components/common/Button'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { Screen } from '../../components/layout/Screen'
import { KakaoMapWebView } from './KakaoMapWebView'
import { StationBottomSheet } from './StationBottomSheet'

// SCR-APP-STATION-001. 카카오맵 JS SDK 커스텀 타일셋 + WebView(DEC-SF-004 번복,
// 2026-08-08 PLAN 참고) — 선택된 대여소 id만 화면 레벨 state로 관리하고, 지도 자체의 줌/팬은
// WebView 안 카카오 엔진이 관리한다.
export function MapScreen() {
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null)
  const stationsQuery = useQuery({ queryKey: ['stations'], queryFn: getStations })

  if (stationsQuery.isPending) {
    return <LoadingScreen />
  }

  if (stationsQuery.isError || !stationsQuery.data) {
    return (
      <Screen>
        <View className="mt-10 gap-4 px-6">
          <ErrorBanner message="대여소 정보를 불러오지 못했어요" />
          <Button label="다시 시도" onPress={() => stationsQuery.refetch()} />
        </View>
      </Screen>
    )
  }

  const stations = stationsQuery.data
  const selectedStation = stations.find((station) => station.id === selectedStationId) ?? null

  return (
    <Screen edges={['top', 'right', 'left']}>
      <KakaoMapWebView
        stations={stations}
        selectedStationId={selectedStationId}
        onSelectStation={setSelectedStationId}
      />
      <StationBottomSheet station={selectedStation} onClose={() => setSelectedStationId(null)} />
    </Screen>
  )
}
