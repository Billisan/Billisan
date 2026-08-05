import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { View } from 'react-native'
import { getStations } from '../../api/stationApi'
import { Button } from '../../components/common/Button'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { Screen } from '../../components/layout/Screen'
import { CampusMap } from './CampusMap'
import { StationBottomSheet } from './StationBottomSheet'

// SCR-APP-STATION-001. 실제 지도 SDK 대신 SVG 기반 가상 캠퍼스 지도(DEC-SF-004 RESOLVED,
// 2026-08-05 사용자 확인) — 선택된 대여소 id만 화면 레벨 state로 관리하고, 줌/팬 상태는
// CampusMap 내부에서 관리한다(스펙 §7).
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
      <CampusMap
        stations={stations}
        selectedStationId={selectedStationId}
        onSelectStation={setSelectedStationId}
      />
      <StationBottomSheet station={selectedStation} onClose={() => setSelectedStationId(null)} />
    </Screen>
  )
}
