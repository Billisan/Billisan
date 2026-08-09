import { MaterialCommunityIcons } from '@expo/vector-icons'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { getHomeSummary } from '../../api/homeApi'
import { getStations } from '../../api/stationApi'
import { getShortTermWeather } from '../../api/weatherApi'
import ChatbotIcon from '../../assets/chatbot.svg'
import { Button } from '../../components/common/Button'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { AppHeader } from '../../components/layout/AppHeader'
import { Screen } from '../../components/layout/Screen'
import type { RootStackParamList } from '../../navigation/RootStackNavigator'
import type { TabParamList } from '../../navigation/TabNavigator'
import { KakaoMapWebView } from '../SCR-APP-STATION-001/KakaoMapWebView'
import type { WeatherCondition } from '../../types/weather'

const RAIN_RECOMMEND_THRESHOLD = 50

type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap

function formatHour(forecastAt: string) {
  return `${new Date(forecastAt).getHours()}시`
}

// 사용자 확인(2026-08-06) — 2026-08-04에 확정했던 "강수확률 구간" 방침을 뒤집고, WEATHER-001의
// condition 필드를 그대로 아이콘에 매핑한다.
function weatherIconName(condition: WeatherCondition): MaterialCommunityIconName {
  switch (condition) {
    case 'CLEAR':
      return 'weather-sunny'
    case 'CLOUDY':
      return 'weather-cloudy'
    case 'RAIN':
      return 'weather-rainy'
    case 'SNOW':
      return 'weather-snowy'
    default:
      return 'help-circle-outline'
  }
}

export function HomeScreen() {
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const tabNavigation = useNavigation<BottomTabNavigationProp<TabParamList>>()
  const [isForecastInfoOpen, setIsForecastInfoOpen] = useState(false)
  const homeQuery = useQuery({ queryKey: ['home'], queryFn: getHomeSummary })
  // 홈 요약과 날씨는 독립된 쿼리로 분리한다 — 날씨 실패가 대여·정산 표시 전체를 막지 않아야 한다
  // (PROJECT_GUIDE.md §4.2 "Partial Success" 원칙).
  const weatherQuery = useQuery({ queryKey: ['home-weather'], queryFn: getShortTermWeather })
  // 지도 미리보기용 — 실패해도 미리보기만 안 뜨고 나머지 홈 화면엔 영향 없어야 하니 독립 쿼리로 분리.
  const stationsQuery = useQuery({ queryKey: ['stations'], queryFn: getStations })

  if (homeQuery.isPending) {
    return <LoadingScreen />
  }

  if (homeQuery.isError || !homeQuery.data) {
    return (
      <Screen>
        <View className="mt-10 gap-4 px-6">
          <ErrorBanner message="홈 정보를 불러오지 못했어요" />
          <Button label="다시 시도" onPress={() => homeQuery.refetch()} />
        </View>
      </Screen>
    )
  }

  const { user, pendingSettlement, alertCount } = homeQuery.data
  const weatherItems = weatherQuery.data?.items ?? []
  const maxRainProbability = Math.max(0, ...weatherItems.map((item) => item.precipitationProbability))

  return (
    <Screen edges={['right', 'bottom', 'left']}>
      <AppHeader
        schoolName={user.schoolName}
        alertCount={alertCount}
        onPressAlert={() => rootNavigation.navigate('Notification')}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-6 pb-24 pt-6"
        refreshControl={
          <RefreshControl
            refreshing={homeQuery.isRefetching || weatherQuery.isRefetching}
            onRefresh={() => {
              homeQuery.refetch()
              weatherQuery.refetch()
            }}
          />
        }
      >
        <View className="gap-2">
          <Text className="text-base font-medium text-text-secondary">
            안녕하세요, {user.displayName}님!
          </Text>
          <Text className="text-2xl font-bold leading-8 text-text">
            오늘도 편하게{'\n'}우산을 이용하세요.
          </Text>
        </View>

        {/* WEATHER-001(§5.12) 위젯 — 2026-08-06 실제 연동으로 전환(DEC-SF-003 RESOLVED, 캠퍼스 고정
            좌표). provider 값은 서버가 주는 그대로("UNDECIDED"일 수 있음), 화면에는 표시하지 않는다. */}
        <View className="gap-4 rounded-2xl bg-white p-5">
          <View className="flex-row items-center justify-between">
            <View className='gap-1'>
              <Text className="text-base font-bold text-text">초단기 강수 예보</Text>
              <Text className="text-xs text-text-secondary">현재부터 6시간 이내 예보</Text>
            </View>
            <View>
              <Pressable
                onPress={() => setIsForecastInfoOpen((prev) => !prev)}
                hitSlop={8}
                className="active:opacity-70"
              >
                <MaterialCommunityIcons name="information-outline" size={18} color="#5C6B7A" />
              </Pressable>
              {isForecastInfoOpen && (
                <View className="absolute right-6 -top-2 z-10 w-44 rounded-lg bg-primary p-2">
                  <Text className="text-xs leading-4 text-black">빌리대학교 기준 강수 예보입니다!</Text>
                </View>
              )}
            </View>
          </View>

          {weatherQuery.isPending && (
            <Text className="text-sm text-text-secondary">예보를 불러오는 중이에요</Text>
          )}
          {weatherQuery.isError && (
            <Text className="text-sm text-text-secondary">날씨 정보를 불러오지 못했어요</Text>
          )}

          {weatherItems.length > 0 && (
            <View className="flex-row justify-between">
              {weatherItems.map((item, index) => (
                <View key={item.forecastAt} className="items-center gap-1">
                  <Text className="text-xs text-text-secondary">
                    {index === 0 ? '지금' : formatHour(item.forecastAt)}
                  </Text>
                  <MaterialCommunityIcons
                    name={weatherIconName(item.condition)}
                    size={22}
                    color="#1E2A38"
                  />
                  <Text
                    className={`text-xs font-bold ${
                      item.precipitationProbability >= RAIN_RECOMMEND_THRESHOLD
                        ? 'text-primary'
                        : 'text-text-secondary'
                    }`}
                  >
                    {item.precipitationProbability}%
                  </Text>
                  {index === 0 && <View className="h-0.5 w-6 rounded-full bg-primary" />}
                </View>
              ))}
            </View>
          )}
        </View>

        {maxRainProbability >= RAIN_RECOMMEND_THRESHOLD && (
          <View className="flex-row items-center gap-3 rounded-2xl bg-secondary p-4">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-white">
              <MaterialCommunityIcons name="umbrella-outline" size={18} color="#1E2A38" />
            </View>
            <Text className="flex-1 text-sm font-medium text-text">
              오늘 비가 예상됩니다. 우산 대여를 추천합니다.
            </Text>
          </View>
        )}

        {/* GAP-004 "현재 상태·지도 조합" 영역 — DEC-SF-004가 카카오맵 커스텀 타일셋으로 확정되어
            (2026-08-09) 지도 미리보기로 채움. 실제 KakaoMapWebView를 작게 임베딩하되 터치는 막고
            (pointerEvents="none") 탭하면 지도 탭으로 이동만 한다 — 마커까지 그대로 보여주기 위해
            정적 이미지 대신 다시 이 방식으로 되돌림(2026-08-09 사용자 확인). 초기 진입 레벨은
            KakaoMapWebView 자체가 2단계(전체 지도)로 고정되어 있어 별도 설정 없이 그대로 적용됨. */}
        <Pressable
          onPress={() => tabNavigation.navigate('Map')}
          className="h-[300px] overflow-hidden rounded-2xl bg-white active:opacity-90"
        >
          <View className="gap-1 p-5 pb-3">
            <Text className="text-base font-bold text-text">캠퍼스 지도</Text>
            <Text className="text-xs text-text-secondary">
              캠퍼스 곳곳의 우산함 위치와 실시간 대여 현황을 확인해보세요
            </Text>
          </View>
          <View className="flex-1" pointerEvents="none">
            <KakaoMapWebView
              stations={stationsQuery.data ?? []}
              selectedStationId={null}
              onSelectStation={() => {}}
              markerSize={24}
              initialLevel={2}
            />
          </View>
        </Pressable>
      </ScrollView>

      <Pressable
        onPress={() => rootNavigation.navigate('Chatbot')}
        className="absolute bottom-8 right-6 active:opacity-80"
      >
        <ChatbotIcon width={68} height={68} />
      </Pressable>
    </Screen>
  )
}
