import { apiClient } from './client'
import type { WeatherForecast } from '../types/weather'

// 우산 대여소가 있는 캠퍼스 고정 좌표(2026-08-06 사용자 확인). 
// 서울 강남구 테헤란로 212
const CAMPUS_LATITUDE = 37.501329
const CAMPUS_LONGITUDE = 127.039538

// WEATHER-001(PROJECT_GUIDE.md §5.12). 호출 경계(App→Spring)와 좌표 출처가 2026-08-06 확정되어
// 실제 연동으로 전환. provider 값 자체(예: "UNDECIDED")는 서버가 주는 그대로 표시한다.
export async function getShortTermWeather(): Promise<WeatherForecast> {
  const response = await apiClient.get<WeatherForecast>('/api/v1/weather/short-term', {
    params: { latitude: CAMPUS_LATITUDE, longitude: CAMPUS_LONGITUDE },
  })
  return response.data
}
