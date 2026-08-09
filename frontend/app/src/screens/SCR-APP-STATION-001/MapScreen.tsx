import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { View } from 'react-native'
import { getHomeSummary } from '../../api/homeApi'
import { getStations } from '../../api/stationApi'
import { Button } from '../../components/common/Button'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { AppHeader } from '../../components/layout/AppHeader'
import { Screen } from '../../components/layout/Screen'
import type { RootStackParamList } from '../../navigation/RootStackNavigator'
import { useAlertReadStore } from '../../store/useAlertReadStore'
import { KakaoMapWebView } from './KakaoMapWebView'
import { StationListSheet } from './StationListSheet'

// SCR-APP-STATION-001. 카카오맵 JS SDK 커스텀 타일셋 + WebView(DEC-SF-004 번복,
// 2026-08-08 PLAN 참고) — 선택된 대여소 id만 화면 레벨 state로 관리하고, 지도 자체의 줌/팬은
// WebView 안 카카오 엔진이 관리한다. Screen edges에서 'bottom'을 뺐다(2026-08-09) — 하단 탭
// 네비게이터가 이미 자체적으로 safe area를 처리해서, 다른 화면과 같이 넣으면 이중 여백이 생겨
// StationListSheet 하단이 탭바에 딱 붙지 않고 틈이 남는다.
export function MapScreen() {
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null)
  // aspect-square가 기대만큼 정사각형으로 안 잡혀서(2026-08-09 실기기 확인), h-2/3로 정한 실측
  // 높이를 그대로 너비로 써서(가운데 정렬) 확실한 정사각형을 만든다.
  const [mapSize, setMapSize] = useState(0)
  const handleMapContainerLayout = (event: LayoutChangeEvent) => {
    setMapSize(event.nativeEvent.layout.height)
  }
  // Dimensions.get('window')는 하단 탭바를 빼지 않은 기기 전체 높이라 StationListSheet 높이
  // 계산이 어긋나서(2026-08-09 실기기 확인), 실제 화면 콘텐츠 영역 높이를 실측해 내려준다.
  const [screenHeight, setScreenHeight] = useState(0)
  const handleScreenLayout = (event: LayoutChangeEvent) => {
    setScreenHeight(event.nativeEvent.layout.height)
  }
  const stationsQuery = useQuery({ queryKey: ['stations'], queryFn: getStations })
  // 다른 화면(내역조회·마이페이지)과 동일하게 알림 배지는 HOME-001을 재사용(전용 API 새로 안 만듦).
  // 쿼리 키를 HomeScreen.tsx와 동일한 'home'으로 둬서 캐시를 공유(2026-08-10 알림 배지 불일치 수정).
  const headerQuery = useQuery({ queryKey: ['home'], queryFn: getHomeSummary })
  const alertReadCount = useAlertReadStore((state) => state.readKeys.size)
  // 새로고침 아이콘용(2026-08-09) — Mock stations는 매번 같은 배열 참조라 refetch만으로는
  // KakaoMapWebView가 다시 그려지지 않아서, 이 값을 바꿔 WebView를 강제로 재마운트한다.
  const [mapRefreshKey, setMapRefreshKey] = useState(0)

  if (stationsQuery.isPending) {
    return <LoadingScreen />
  }

  if (stationsQuery.isError || !stationsQuery.data) {
    return (
      <Screen edges={['right', 'left']}>
        <AppHeader
          schoolName={headerQuery.data?.user.schoolName ?? ''}
          alertCount={Math.max((headerQuery.data?.alertCount ?? 0) - alertReadCount, 0)}
          onPressAlert={() => rootNavigation.navigate('Notification')}
        />
        <View className="mt-10 gap-4 px-6">
          <ErrorBanner message="대여소 정보를 불러오지 못했어요" />
          <Button label="다시 시도" onPress={() => stationsQuery.refetch()} />
        </View>
      </Screen>
    )
  }

  const stations = stationsQuery.data

  return (
    <Screen edges={['right', 'left']}>
      <View className="flex-1" onLayout={handleScreenLayout}>
        <AppHeader
          schoolName={headerQuery.data?.user.schoolName ?? ''}
          alertCount={Math.max((headerQuery.data?.alertCount ?? 0) - alertReadCount, 0)}
          onPressAlert={() => rootNavigation.navigate('Notification')}
        />

        {/* 2단계(초기 진입) 타일이 정사각형 1장이라, 화면 전체 높이로 늘리면 타일 밖 영역이
            fallback 회색으로 보인다. aspect-square가 RN에서 안정적으로 안 잡혀서(2026-08-09
            실기기 확인), h-2/3로 정한 실측 높이를 그대로 너비로 강제해(가운데 정렬) 확실한
            정사각형을 만든다. */}
        <View
          className="relative h-2/3 self-center"
          style={mapSize ? { width: mapSize } : { width: '100%' }}
          onLayout={handleMapContainerLayout}
        >
          <KakaoMapWebView
            stations={stations}
            selectedStationId={selectedStationId}
            onSelectStation={setSelectedStationId}
            refreshKey={mapRefreshKey}
          />
        </View>
        {/* 상시 노출 대여소 목록 시트(2026-08-09) — 우산 재고 tier 범례 + 필터 + 목록을 담고,
            지도 위에 absolute로 겹쳐 드래그로 일부 열림↔꽉 참 사이를 오간다. screenHeight가
            측정되기 전에는 마운트하지 않는다(0 높이 기준 계산 방지). */}
        {screenHeight > 0 && (
          <StationListSheet
            stations={stations}
            selectedStationId={selectedStationId}
            onSelectStation={setSelectedStationId}
            containerHeight={screenHeight}
            onRefresh={() => {
              stationsQuery.refetch()
              headerQuery.refetch()
              setMapRefreshKey((key) => key + 1)
            }}
          />
        )}
      </View>
    </Screen>
  )
}
